#!/usr/bin/env python3
"""
Validates data/events.json for the History of Christianity timeline (history/).
Run it after editing events by hand; the "Validate events data" GitHub Action
runs it on every push that touches the file.

Errors (exit code 1) break the page or its links; warnings are worth a look
but the page still works.

Usage:
    python3 scripts/validate_events.py [path/to/events.json]
    python3 scripts/validate_events.py --names   # also list looser name matches for manual review
"""
import difflib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "data" / "events.json"

ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
LANGS = ("ru", "en")
TEXT_FIELDS = ("date_label", "title", "summary", "place", "date_note")
LIST_FIELDS = ("key_points", "people")
REQUIRED_NONEMPTY = ("date_label", "title", "summary")
# Two names that differ in one word with at least this similarity are likely
# the same person spelled differently ("Августин Гиппонский" / "Августин Иппонский").
NAME_SIMILARITY = 0.85
NAME_SIMILARITY_LOOSE = 0.7
ROMAN_RE = re.compile(r"^[ivxlc]+$")


def name_tokens(name):
    return re.findall(r"[\w-]+", name.lower().replace("ё", "е"))


def similar_names(names, threshold):
    """Pairs of names equal except for one word whose spellings are close.
    Words that are Roman numerals are skipped: "Павел III" / "Павел VI" are different people."""
    by_len = defaultdict(list)
    for n in sorted(set(names)):
        t = name_tokens(n)
        if len(t) >= 2:
            by_len[len(t)].append((n, t))
    pairs = []
    for group in by_len.values():
        for i, (a, ta) in enumerate(group):
            for b, tb in group[i + 1:]:
                diff = [(x, y) for x, y in zip(ta, tb) if x != y]
                if len(diff) != 1:
                    continue
                x, y = diff[0]
                if ROMAN_RE.match(x) or ROMAN_RE.match(y):
                    continue
                ratio = difflib.SequenceMatcher(None, x, y).ratio()
                if ratio >= threshold:
                    pairs.append((ratio, a, b))
    return sorted(pairs, reverse=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    show_loose = "--names" in sys.argv[1:]
    path = Path(args[0]) if args else DEFAULT_PATH
    errors, warnings = [], []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ОШИБКА: файл не найден: {path}")
        return 1
    except json.JSONDecodeError as e:
        print(f"ОШИБКА: невалидный JSON в {path}: строка {e.lineno}, столбец {e.colno}: {e.msg}")
        return 1

    meta = data.get("meta")
    events = data.get("events")
    if not isinstance(meta, dict) or not isinstance(events, list):
        print("ОШИБКА: в корне должны быть объект \"meta\" и массив \"events\"")
        return 1

    # --- meta ---
    for key in ("title_ru", "title_en", "note_ru", "note_en"):
        if not isinstance(meta.get(key), str) or not meta.get(key).strip():
            errors.append(f"meta.{key}: пустое или отсутствует")

    refs = {}
    for group in ("eras", "categories", "books"):
        items = meta.get(group)
        if not isinstance(items, list) or not items:
            errors.append(f"meta.{group}: должен быть непустым массивом")
            refs[group] = {}
            continue
        seen = {}
        for i, item in enumerate(items):
            iid = item.get("id") if isinstance(item, dict) else None
            where = f"meta.{group}[{i}]"
            if not isinstance(iid, str) or not iid:
                errors.append(f"{where}: нет id")
                continue
            if iid in seen:
                errors.append(f"{where}: повторяется id \"{iid}\"")
            for lang in LANGS:
                if not isinstance(item.get(lang), str) or not item[lang].strip():
                    errors.append(f"{where} ({iid}): пустое поле \"{lang}\"")
            seen[iid] = item
        refs[group] = seen

    eras = meta.get("eras") or []
    for i, era in enumerate(eras):
        lo, hi = era.get("from"), era.get("to")
        for k, v in (("from", lo), ("to", hi)):
            if v is not None and not isinstance(v, int):
                errors.append(f"meta.eras[{i}] ({era.get('id')}): \"{k}\" должен быть целым числом или null")
        if isinstance(lo, int) and isinstance(hi, int) and lo > hi:
            errors.append(f"meta.eras[{i}] ({era.get('id')}): from > to")

    count = meta.get("count")
    if count != len(events):
        errors.append(f"meta.count = {count}, а событий в массиве {len(events)}")

    # --- events ---
    ids = {}
    prev_year = None
    era_ranges = {e.get("id"): (e.get("from"), e.get("to")) for e in eras if isinstance(e, dict)}

    for i, ev in enumerate(events):
        if not isinstance(ev, dict):
            errors.append(f"events[{i}]: не объект")
            continue
        eid = ev.get("id")
        where = f"events[{i}] ({eid})"

        if not isinstance(eid, str) or not ID_RE.match(eid):
            errors.append(f"{where}: id должен состоять из строчных латинских букв, цифр, \"-\" или \"_\"")
        elif eid in ids:
            errors.append(f"{where}: id уже используется в events[{ids[eid]}]")
        else:
            ids[eid] = i

        ys, ye = ev.get("year_start"), ev.get("year_end")
        if not isinstance(ys, int) or isinstance(ys, bool):
            errors.append(f"{where}: year_start должен быть целым числом")
            ys = None
        if not isinstance(ye, int) or isinstance(ye, bool):
            errors.append(f"{where}: year_end должен быть целым числом")
        elif ys is not None and ye < ys:
            errors.append(f"{where}: year_end ({ye}) меньше year_start ({ys})")

        if ys is not None:
            if prev_year is not None and ys < prev_year:
                errors.append(f"{where}: нарушен порядок — year_start {ys} меньше, чем у предыдущего события ({prev_year})")
            prev_year = ys

        era = ev.get("era")
        if era not in refs["eras"]:
            errors.append(f"{where}: неизвестная эпоха \"{era}\"")
        elif ys is not None:
            lo, hi = era_ranges.get(era, (None, None))
            if (lo is not None and ys < lo) or (hi is not None and ys > hi):
                warnings.append(f"{where}: year_start {ys} вне диапазона эпохи \"{era}\" ({lo}–{hi})")

        if ev.get("category") not in refs["categories"]:
            errors.append(f"{where}: неизвестная категория \"{ev.get('category')}\"")

        if ev.get("importance") not in (1, 2, 3):
            errors.append(f"{where}: importance должен быть 1, 2 или 3")

        for field in TEXT_FIELDS:
            for lang in LANGS:
                key = f"{field}_{lang}"
                val = ev.get(key)
                if not isinstance(val, str):
                    errors.append(f"{where}: {key} должен быть строкой")
                elif field in REQUIRED_NONEMPTY and not val.strip():
                    errors.append(f"{where}: {key} пустое")
            ru, en = ev.get(f"{field}_ru"), ev.get(f"{field}_en")
            if isinstance(ru, str) and isinstance(en, str) and bool(ru.strip()) != bool(en.strip()):
                warnings.append(f"{where}: {field} заполнено только на одном языке")

        for field in LIST_FIELDS:
            for lang in LANGS:
                key = f"{field}_{lang}"
                val = ev.get(key)
                if not isinstance(val, list) or not all(isinstance(x, str) and x.strip() for x in val):
                    errors.append(f"{where}: {key} должен быть массивом непустых строк")
            ru, en = ev.get(f"{field}_ru"), ev.get(f"{field}_en")
            if isinstance(ru, list) and isinstance(en, list) and len(ru) != len(en):
                warnings.append(f"{where}: в {field}_ru {len(ru)} элем., в {field}_en {len(en)}")

        for lang in LANGS:
            people = ev.get(f"people_{lang}")
            if not isinstance(people, list):
                continue
            seen = set()
            for p in people:
                key = " ".join(name_tokens(p)) if isinstance(p, str) else p
                if key in seen:
                    warnings.append(f"{where}: people_{lang} — «{p}» указан дважды")
                seen.add(key)
            for _, a, b in similar_names([p for p in people if isinstance(p, str)], NAME_SIMILARITY):
                warnings.append(f"{where}: people_{lang} — «{a}» и «{b}» похожи на одного человека")

        sources = ev.get("sources")
        if not isinstance(sources, list):
            errors.append(f"{where}: sources должен быть массивом")
        else:
            if not sources:
                warnings.append(f"{where}: нет источников")
            for j, s in enumerate(sources):
                book = s.get("book") if isinstance(s, dict) else None
                if book not in refs["books"]:
                    errors.append(f"{where}: sources[{j}] — неизвестная книга \"{book}\"")
                if isinstance(s, dict) and not isinstance(s.get("pages"), str):
                    errors.append(f"{where}: sources[{j}].pages должен быть строкой")

    # --- names across all events ---
    for lang in LANGS:
        names = [p for ev in events if isinstance(ev, dict) for p in (ev.get(f"people_{lang}") or []) if isinstance(p, str)]
        for ratio, a, b in similar_names(names, NAME_SIMILARITY):
            warnings.append(f"people_{lang}: «{a}» и «{b}» — вероятно, один человек, записанный по-разному (сходство {ratio:.2f})")
        if show_loose:
            loose = [x for x in similar_names(names, NAME_SIMILARITY_LOOSE) if x[0] < NAME_SIMILARITY]
            print(f"\n[--names] people_{lang}: похожие имена для ручной проверки ({len(loose)}), чаще всего это разные люди:")
            for ratio, a, b in loose:
                print(f"  {ratio:.2f}  {a}  /  {b}")

    # --- report ---
    for w in warnings:
        print(f"предупреждение: {w}")
    for e in errors:
        print(f"ОШИБКА: {e}")
    status = "есть ошибки" if errors else "OK"
    print(f"\n{path.name}: {len(events)} событий, ошибок: {len(errors)}, предупреждений: {len(warnings)} — {status}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
