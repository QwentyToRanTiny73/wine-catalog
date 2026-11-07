#!/usr/bin/env python3
"""Сборка данных колеса ароматов (фаза 4).

Вход (утверждаемые таблицы):
  data/aroma-taxonomy.csv     категория; группа; дескриптор (решение Р21)
  data/aroma-descriptors.csv  сорт; дескриптор; интенсивность 1–3; вещество; цитата; источник… ; status
  data/variety-map.csv        канонические названия сортов (Р18)

Выход (генерируется, руками не править):
  src/data/aroma/taxonomy.json   категории → группы → дескрипторы (с id)
  src/data/aroma/varieties.json  все сорта; для каждого — дескрипторы с интенсивностью и источниками

status: «интернет, проверить» — показывается с этой пометкой (Р10, Р26); «проверено» — без пометки;
        «скрыто» — на сайт не попадает.
Любая ошибка (дескриптор не из таксономии, сорт не из утверждённых строк variety-map, интенсивность
вне 1–3, запись без источника — ссылки, цитаты, даты обращения) останавливает сборку, файлы не перезаписываются.

  python3 -I scripts/build_aroma.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAXONOMY_CSV = ROOT / "data" / "aroma-taxonomy.csv"
DESCRIPTORS_CSV = ROOT / "data" / "aroma-descriptors.csv"
VARIETY_MAP = ROOT / "data" / "variety-map.csv"
OUT_DIR = ROOT / "src" / "data" / "aroma"

STATUSES = {"интернет, проверить": "check", "проверено": "ok", "скрыто": "hidden"}
APPROVED = "утверждено"   # как в build_data.py: сорта — только из утверждённых строк variety-map
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")

TRANSLIT = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
                    ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s",
                     "t", "u", "f", "h", "c", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya"]))


def slug(text: str) -> str:
    """«Чёрный перец» → «chernyj-perec»: стабильный латинский id для адреса страницы."""
    out = "".join(TRANSLIT.get(ch, ch) for ch in text.lower())
    out = "".join(ch if ch.isalnum() else "-" for ch in out)
    return "-".join(p for p in out.split("-") if p)


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def build() -> tuple[dict, dict]:
    errors: list[str] = []

    # Таксономия: категория → группа → дескриптор, порядок как в CSV
    taxonomy: dict = {"categories": []}
    descriptor_ids: dict[str, str] = {}
    for row in read_csv(TAXONOMY_CSV):
        cat_name, group_name, name = row["category"].strip(), row["group"].strip(), row["descriptor"].strip()
        cats = taxonomy["categories"]
        if not cats or cats[-1]["name"] != cat_name:
            cats.append({"id": slug(cat_name.split("—")[0]), "name": cat_name, "groups": []})
        groups = cats[-1]["groups"]
        if not groups or groups[-1]["name"] != group_name:
            groups.append({"id": slug(group_name), "name": group_name, "descriptors": []})
        did = slug(name)
        if did in descriptor_ids.values():
            errors.append(f"{rel(TAXONOMY_CSV)}: повтор дескриптора «{name}» (id {did})")
        descriptor_ids[name] = did
        groups[-1]["descriptors"].append({"id": did, "name": name})

    varieties = sorted({v.strip() for r in read_csv(VARIETY_MAP) if r["status"].strip() == APPROVED
                        for v in r["varieties"].split("+") if v.strip()},
                       key=lambda v: v.lower().replace("ё", "е"))

    # Дескрипторы сортов: одна пара «сорт — дескриптор» может иметь несколько источников
    sources: list[dict] = []
    source_index: dict[tuple, int] = {}
    profiles: dict[str, dict] = {v: {} for v in varieties}
    for n, row in enumerate(read_csv(DESCRIPTORS_CSV), start=2):
        where = f"{rel(DESCRIPTORS_CSV)}, строка {n}"
        variety, name = row["variety"].strip(), row["descriptor"].strip()
        status = STATUSES.get(row["status"].strip())
        if status is None:
            errors.append(f"{where}: статус «{row['status']}» — допустимо: {', '.join(STATUSES)}")
            continue
        if status == "hidden":
            continue
        if variety not in profiles:
            errors.append(f"{where}: сорта «{variety}» нет в {rel(VARIETY_MAP)}")
            continue
        if name not in descriptor_ids:
            errors.append(f"{where}: дескриптора «{name}» нет в {rel(TAXONOMY_CSV)}")
            continue
        try:
            intensity = int(row["intensity"])
        except ValueError:
            intensity = 0
        if intensity not in (1, 2, 3):
            errors.append(f"{where}: интенсивность «{row['intensity']}» — нужно 1, 2 или 3")
            continue
        url = row["source_url"].strip()
        accessed = row["accessed"].strip()
        if not url.startswith(("http://", "https://")) or not row["quote"].strip() or not DATE.fullmatch(accessed):
            errors.append(f"{where}: нет источника (ссылки, цитаты, даты обращения ГГГГ-ММ-ДД) — без источника записи нет (Р10)")
            continue
        # один источник = одна ссылка с тем же названием и датой обращения: у новой цитаты по старой ссылке — своя дата
        key = (url, row["source_title"].strip(), row["source_type"].strip(), accessed)
        if key not in source_index:
            source_index[key] = len(sources)
            sources.append({"title": key[1], "url": url, "type": key[2], "accessed": accessed})
        entry = profiles[variety].setdefault(descriptor_ids[name], {"intensity": 0, "evidence": []})
        entry["intensity"] = max(entry["intensity"], intensity)
        entry["evidence"].append({k: v for k, v in {
            "source": source_index[key], "intensity": intensity, "quote": row["quote"].strip(),
            "compound": row["compound"].strip(), "note": row["note"].strip(), "status": status,
        }.items() if v != ""})

    if errors:
        raise SystemExit("ОШИБКА: сборка ароматов остановлена:\n" + "\n".join(f"  - {e}" for e in errors))
    return taxonomy, {"varieties": profiles, "sources": sources}


def main() -> int:
    taxonomy, varieties = build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, data in (("taxonomy.json", taxonomy), ("varieties.json", varieties)):
        (OUT_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    profiles = varieties["varieties"]
    with_data = [v for v, p in profiles.items() if p]
    pairs = sum(len(p) for p in profiles.values())
    print(f"Дескрипторов в таксономии: {sum(len(g['descriptors']) for c in taxonomy['categories'] for g in c['groups'])}")
    print(f"Сортов: {len(profiles)}, с данными: {len(with_data)}; пар «сорт — дескриптор»: {pairs}; источников: {len(varieties['sources'])}")
    print("Без данных:", ", ".join(v for v, p in profiles.items() if not p) or "—")
    return 0


if __name__ == "__main__":
    sys.exit(main())
