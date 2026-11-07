#!/usr/bin/env python3
"""Пометки к образцам: data/sample-notes.csv → src/data/notes.json.

Excel не нужен — проверка идёт по уже собранному src/data/samples.json, поэтому скрипт
запускается и в GitHub Actions (после правки пометок через /admin/, решение Р27).
Ошибка (нет образца с таким номером, поле не показывается на сайте, у образца это поле пустое —
пометку никто не увидит) останавливает сборку.

  python3 -I scripts/build_notes.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTES_CSV = ROOT / "data" / "sample-notes.csv"
SAMPLES = ROOT / "src" / "data" / "samples.json"
OUT = ROOT / "src" / "data" / "notes.json"


def main() -> int:
    data = json.loads(SAMPLES.read_text(encoding="utf-8"))
    by_number = {s["labNumber"]: s for s in data["samples"] if "labNumber" in s}
    fields = {f["key"] for f in data["fields"]}
    notes: dict[str, list[dict]] = {}
    errors = []
    with NOTES_CSV.open(encoding="utf-8-sig", newline="") as f:
        for n, row in enumerate(csv.DictReader(f, delimiter=";"), start=2):
            where = f"data/sample-notes.csv, строка {n}"
            try:
                number = int(row["labNumber"])
            except ValueError:
                errors.append(f"{where}: номер образца «{row['labNumber']}» — не число")
                continue
            field, text = row["field"].strip(), row["note"].strip()
            if number not in by_number:
                errors.append(f"{where}: образца с номером {number} нет в данных")
            elif field not in fields:
                errors.append(f"{where}: поле «{field}» не показывается на сайте — пометку никто не увидит")
            elif by_number[number].get(field) in (None, ""):
                errors.append(f"{where}: у образца {number} поле «{field}» пустое — пометку никто не увидит")
            elif not text:
                errors.append(f"{where}: пустой текст пометки")
            else:
                notes.setdefault(str(number), []).append({"field": field, "text": text})
    if errors:
        print("ОШИБКА: пометки не собраны:\n" + "\n".join(f"  - {e}" for e in errors), file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(notes, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Пометок: {sum(len(v) for v in notes.values())} у {len(notes)} образцов → {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
