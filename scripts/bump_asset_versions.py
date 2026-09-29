#!/usr/bin/env python3
"""
Keeps the cache-busting ?v= parameters in history/index.html in sync with the
content of the files they point to (css/style.css, js/app.js).

GitHub Pages lets browsers cache files for up to 10 minutes. If app.js changes
but index.html still references the old ?v=, a visitor can get the new page with
the old script (or the other way round). The version is the first 10 hex chars
of the file's SHA-256, so it changes exactly when the file changes.

Usage:
    python3 scripts/bump_asset_versions.py          # rewrite index.html
    python3 scripts/bump_asset_versions.py --check  # exit 1 if a version is stale (used in CI)
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "history"
PAGE = ROOT / "index.html"
ASSETS = ("css/style.css", "js/app.js")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def main():
    check = "--check" in sys.argv[1:]
    html = PAGE.read_text(encoding="utf-8")
    new_html = html
    stale = []

    for asset in ASSETS:
        want = digest(ROOT / asset)
        pattern = re.compile(r'(["\'])' + re.escape(asset) + r'(?:\?v=([^"\']*))?\1')
        matches = list(pattern.finditer(html))
        if not matches:
            print(f"ОШИБКА: {asset} не найден в {PAGE.name}")
            return 1
        for m in matches:
            if m.group(2) != want:
                stale.append(f"{asset}: v={m.group(2) or '—'} → v={want}")
        new_html = pattern.sub(lambda m: f"{m.group(1)}{asset}?v={want}{m.group(1)}", new_html)

    if not stale:
        print("Версии файлов актуальны.")
        return 0
    if check:
        print("Версии файлов устарели — запустите python3 scripts/bump_asset_versions.py:")
        for s in stale:
            print("  " + s)
        return 1
    PAGE.write_text(new_html, encoding="utf-8")
    for s in stale:
        print("Обновлено: " + s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
