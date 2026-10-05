#!/usr/bin/env python3
"""
Keeps the cache-busting ?v= parameters in history/index.html and
doctrines/index.html in sync with the content of the files they point to.

GitHub Pages lets browsers cache files for up to 10 minutes. If app.js changes
but index.html still references the old ?v=, a visitor can get the new page with
the old script (or the other way round). The version is the first 10 hex chars
of the file's SHA-256, so it changes exactly when the file changes.

Only references that already carry ?v= are rewritten. In doctrines/index.html the
ES modules are versioned through an import map: its keys ("./js/util.js") stay
bare, its values ("./js/util.js?v=…") get the version.

Usage:
    python3 scripts/bump_asset_versions.py          # rewrite index.html files
    python3 scripts/bump_asset_versions.py --check  # exit 1 if a version is stale (used in CI)
"""
import hashlib
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SITES = {
    "history": ("css/style.css", "js/app.js"),
    "doctrines": (
        "css/style.css", "js/app.js", "js/i18n.js", "js/util.js",
        "js/views/common.js", "js/views/matrix.js", "js/views/doctrine.js",
        "js/views/timeline.js", "js/views/glossary.js", "js/views/about.js",
        "js/views/item.js",
    ),
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def bump(site, assets, check):
    root = BASE / site
    page = root / "index.html"
    html = page.read_text(encoding="utf-8")
    new_html = html
    stale, errors = [], []

    for asset in assets:
        want = digest(root / asset)
        pattern = re.compile(r'(["\'])((?:\./)?)' + re.escape(asset) + r'\?v=([^"\']*)\1')
        matches = list(pattern.finditer(html))
        if not matches:
            errors.append(f"ОШИБКА: {asset}?v= не найден в {site}/index.html")
            continue
        for m in matches:
            if m.group(3) != want:
                stale.append(f"{site}/{asset}: v={m.group(3) or '—'} → v={want}")
        new_html = pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}{asset}?v={want}{m.group(1)}", new_html)

    if stale and not check:
        page.write_text(new_html, encoding="utf-8")
    return stale, errors


def main():
    check = "--check" in sys.argv[1:]
    all_stale, all_errors = [], []
    for site, assets in SITES.items():
        stale, errors = bump(site, assets, check)
        all_stale += stale
        all_errors += errors

    for e in all_errors:
        print(e)
    if all_errors:
        return 1
    if not all_stale:
        print("Версии файлов актуальны.")
        return 0
    if check:
        print("Версии файлов устарели — запустите python3 scripts/bump_asset_versions.py:")
        for s in all_stale:
            print("  " + s)
        return 1
    for s in all_stale:
        print("Обновлено: " + s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
