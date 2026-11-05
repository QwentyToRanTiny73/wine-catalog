#!/usr/bin/env python3
"""Сборка данных сайта из исходного Excel (фаза 2).

Исходник: единственный .xlsx в data/source/ (в git не попадает, решение Р3).

Команды:
  python3 scripts/build_data.py draft
      Готовит черновики на утверждение владельцу:
        data/variety-map.csv — написание сорта в Excel → канонические сорта;
        data/fields.csv      — подпись, единица и точность каждого показателя.
      Спорные случаи не решает (решение Р7): помечает «спорно» и объясняет почему.

Полная сборка (src/data/samples.json, data/report.md) добавляется
после утверждения черновиков.
"""
from __future__ import annotations

import argparse
import collections
import csv
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "source"
VARIETY_MAP = ROOT / "data" / "variety-map.csv"
FIELDS_CSV = ROOT / "data" / "fields.csv"

SHEET = "БД"
HEADER_ROW = 4       # названия колонок
UNIT_ROW = 5         # единицы измерения / расшифровки кодов
FIRST_DATA_ROW = 6

# CSV для владельца: «;» и BOM, чтобы русский Excel открыл файл сразу по колонкам.
CSV_DELIMITER = ";"
CSV_ENCODING = "utf-8-sig"
BLEND_SEPARATOR = " + "   # разделитель сортов купажа внутри ячейки

# Название колонки в Excel (после normalize_header) → ключ поля и тип.
# Колонки ищутся по названию, а не по позиции: вставка колонки ничего не сдвинет.
COLUMNS: dict[str, tuple[str, str]] = {
    "номер": ("labNumber", "int"),
    "виноградо-винодельческий район по аввр (2024 г.)": ("wineDistrict", "text"),
    "природно-климатическая зона выращивания винограда": ("climateZone", "text"),
    "природно-климатический район выращивания винограда": ("climateRegion", "text"),
    "административный район выращивания винграда": ("adminRegion", "text"),  # «винграда» — как в исходнике
    "место расположение виноградника (населенный пункт)": ("location", "text"),
    "производитель винограда (хозяйство)": ("grapeProducer", "text"),
    "производитель вина (винодельня)": ("winery", "text"),
    "тип винодельческой продукции": ("productType", "code"),
    "наименование образца": ("name", "text"),
    "сортовой состав": ("varietyRaw", "text"),
    "год урожая": ("harvestYear", "int"),
    "цвет": ("color", "code"),
    "объемная доля этилового спирта": ("alcohol", "number"),
    "приведенный экстракт": ("reducedExtract", "number"),
    "титруемая кислотность": ("titratedAcidity", "number"),
    "сахара": ("sugar", "number"),
    "лимонная кислота": ("citricAcid", "number"),
    "винная кислота": ("tartaricAcid", "number"),
    "яблочная кислота": ("malicAcid", "number"),
    "янтарная кислота": ("succinicAcid", "number"),
    "молочная кислота": ("lacticAcid", "number"),
    "уксусная кислота": ("aceticAcid", "number"),
    "биозы (в пересчете на сахарозу)": ("bioses", "number"),
    "глюкоза": ("glucose", "number"),
    "фруктоза": ("fructose", "number"),
    "глицерин": ("glycerin", "number"),
    "хлориды": ("chlorides", "number"),
    "натрий": ("sodium", "number"),
    "калий": ("potassium", "number"),
    "магний": ("magnesium", "number"),
    "кальций": ("calcium", "number"),
    "сумма фенольных веществ": ("phenolicSubstances", "number"),
    "рн": ("ph", "number"),   # в исходнике кириллицей
    "буферная емкость щелочью": ("bufferCapacity", "number"),
    "электропроводность": ("electricConductivity", "number"),
}

# Написания сортов, которые владелец сам использовал в ТЗ (решение Р10).
# Если сорт есть в этом списке, предлагаем именно такое написание.
OWNER_SPELLINGS = [
    "Кефессия", "Эким кара", "Джеват кара", "Кокур белый", "Сары пандас",
    "Бастардо магарачский", "Красень", "Первенец Магарача", "Цитронный Магарача",
]
# Пары, которые владелец назвал разными сортами (решение Р15): не помечаем как похожие.
DISTINCT_PAIRS = {frozenset({"совиньон белый", "совиньон зеленый"})}
# Значения «Сортового состава», которые не являются названием сорта.
NOT_A_VARIETY = {"купаж"}


class DataError(Exception):
    """Ошибка во входных данных: сообщение понятно владельцу, без трассировки."""


# ── Чтение Excel ─────────────────────────────────────────────────────────────

def normalize_header(text) -> str:
    s = str(text or "").replace("ё", "е").replace("Ё", "Е").lower()
    return re.sub(r"\s+", " ", s).strip()


def find_source() -> Path:
    files = sorted(p for p in SOURCE_DIR.glob("*.xlsx") if not p.name.startswith("~$"))
    if len(files) != 1:
        names = ", ".join(p.name for p in files) or "нет файлов"
        raise DataError(
            f"В {SOURCE_DIR.relative_to(ROOT)}/ должен лежать ровно один .xlsx, сейчас: {names}"
        )
    return files[0]


def read_sheet(path: Path):
    """Возвращает (columns, rows): columns — список (ключ, тип, заголовок, единица) по позициям,
    rows — список (номер строки Excel, {ключ: сырое значение})."""
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    if SHEET not in wb.sheetnames:
        raise DataError(f"В файле {path.name} нет листа «{SHEET}». Листы: {', '.join(wb.sheetnames)}")
    ws = wb[SHEET]

    header = next(ws.iter_rows(min_row=HEADER_ROW, max_row=HEADER_ROW, values_only=True))
    units = next(ws.iter_rows(min_row=UNIT_ROW, max_row=UNIT_ROW, values_only=True))

    columns: dict[int, tuple[str, str, str, str]] = {}
    unknown = []
    for idx, title in enumerate(header):
        if title is None:
            continue
        key = normalize_header(title)
        if key not in COLUMNS:
            unknown.append(f"колонка {idx + 1}: «{title}»")
            continue
        field, kind = COLUMNS[key]
        unit = str(units[idx]).strip() if idx < len(units) and units[idx] is not None else ""
        columns[idx] = (field, kind, str(title).strip(), unit)

    missing = sorted(set(k for k, _ in COLUMNS.values()) - {c[0] for c in columns.values()})
    if unknown or missing:
        lines = []
        if unknown:
            lines.append("Неизвестные колонки (добавьте их в COLUMNS в scripts/build_data.py):")
            lines += [f"  - {u}" for u in unknown]
        if missing:
            lines.append("Не найдены ожидаемые колонки: " + ", ".join(missing))
        raise DataError("\n".join(lines))

    rows = []
    last = max(columns)
    for excel_row, values in enumerate(
        ws.iter_rows(min_row=FIRST_DATA_ROW, max_col=last + 1, values_only=True), start=FIRST_DATA_ROW
    ):
        if all(v is None or str(v).strip() == "" for v in values):
            continue
        rows.append((excel_row, {columns[i][0]: values[i] for i in columns}))
    return list(columns.values()), rows


# ── Сорта ────────────────────────────────────────────────────────────────────

def clean_variety(text: str) -> str:
    """Механическая чистка без смысловых решений: пробелы и пробелы вокруг дефиса."""
    s = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"\s*-\s*", "-", s)


def variety_key(text: str) -> str:
    return clean_variety(text).replace("ё", "е").replace("Ё", "Е").lower()


def split_blend(raw: str) -> list[str]:
    return [clean_variety(p) for p in raw.split(",") if clean_variety(p)]


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def draft_variety_map(rows) -> list[dict]:
    raw_rows: dict[str, list[int]] = collections.defaultdict(list)
    spellings: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for excel_row, rec in rows:
        raw = "" if rec["varietyRaw"] is None else str(rec["varietyRaw"])
        raw_rows[raw].append(excel_row)
        if variety_key(raw) in NOT_A_VARIETY:
            continue
        for part in split_blend(raw):
            spellings[variety_key(part)][part] += 1

    owner = {variety_key(s): s for s in OWNER_SPELLINGS}

    def canonical(key: str) -> tuple[str, list[str]]:
        """Предлагаемое написание и список причин, почему это спорно."""
        seen = spellings[key]
        doubts = []
        if key in owner:
            name = owner[key]
            if name not in seen:
                doubts.append(f"в данных пишется «{seen.most_common(1)[0][0]}», в ТЗ (Р10) — «{name}»")
        else:
            name = seen.most_common(1)[0][0]
        if len(seen) > 1:
            variants = ", ".join(f"«{s}» ×{n}" for s, n in seen.most_common())
            doubts.append(f"разные написания: {variants}")
        for other in spellings:
            if other != key and frozenset({key, other}) not in DISTINCT_PAIRS \
                    and min(len(key), len(other)) >= 5 and edit_distance(key, other) <= 1:
                doubts.append(f"похоже на «{spellings[other].most_common(1)[0][0]}» — один сорт или разные?")
        return name, doubts

    out = []
    for raw, excel_rows in sorted(raw_rows.items(), key=lambda kv: variety_key(kv[0])):
        parts = [] if variety_key(raw) in NOT_A_VARIETY else split_blend(raw)
        names, doubts, basis = [], [], []
        for part in parts:
            name, d = canonical(variety_key(part))
            names.append(name)
            doubts += d
            if name != part:
                basis.append(f"«{part}» → «{name}»")
        if raw.strip() == "":
            status, comment = "пусто", "сорт не указан в исходнике — известен ли он?"
        elif variety_key(raw) in NOT_A_VARIETY:
            status, comment = "спорно", "состав купажа не указан — известны ли сорта?"
        elif doubts:
            status, comment = "спорно", "; ".join(dict.fromkeys(doubts))
        else:
            status, comment = "предложено", ""
        if len(names) > 1:
            basis.append("купаж: порядок сортов как в исходнике")
        if raw != clean_variety(raw) and raw.strip():
            basis.append("убраны лишние пробелы")
        out.append({
            "raw": raw,
            "count": len(excel_rows),
            "varieties": BLEND_SEPARATOR.join(names),
            "status": status,
            "basis": "; ".join(basis),
            "comment": comment,
            "excel_rows": ", ".join(map(str, excel_rows)),
        })
    return out


# ── Поля ─────────────────────────────────────────────────────────────────────

# Предлагаемые подписи для сайта (утверждает владелец). Исходный заголовок
# Excel сохраняется в колонке excel_header для сверки.
LABELS = {
    "labNumber": "Номер образца",
    "wineDistrict": "Виноградо-винодельческий район (АВВР, 2024)",
    "climateZone": "Природно-климатическая зона",
    "climateRegion": "Природно-климатический район",
    "adminRegion": "Административный район",
    "location": "Населённый пункт",
    "grapeProducer": "Производитель винограда",
    "winery": "Производитель вина",
    "productType": "Тип продукции",
    "name": "Наименование образца",
    "varietyRaw": "Сортовой состав",
    "harvestYear": "Год урожая",
    "color": "Цвет",
    "alcohol": "Объёмная доля этилового спирта",
    "reducedExtract": "Приведённый экстракт",
    "titratedAcidity": "Титруемая кислотность",
    "sugar": "Сахара",
    "citricAcid": "Лимонная кислота",
    "tartaricAcid": "Винная кислота",
    "malicAcid": "Яблочная кислота",
    "succinicAcid": "Янтарная кислота",
    "lacticAcid": "Молочная кислота",
    "aceticAcid": "Уксусная кислота",
    "bioses": "Биозы (в пересчёте на сахарозу)",
    "glucose": "Глюкоза",
    "fructose": "Фруктоза",
    "glycerin": "Глицерин",
    "chlorides": "Хлориды",
    "sodium": "Натрий",
    "potassium": "Калий",
    "magnesium": "Магний",
    "calcium": "Кальций",
    "phenolicSubstances": "Сумма фенольных веществ",
    "ph": "pH",
    "bufferCapacity": "Буферная ёмкость (щелочью)",
    "electricConductivity": "Электропроводность",
}


def display_unit(unit: str) -> str:
    """Только типографика: дм3 → дм³. Смысл единицы не меняется."""
    return unit.strip().replace("дм3", "дм³")


def to_number(value):
    """Число из ячейки; строки с запятой тоже понимаем. Возвращает (число|None, было_текстом)."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None, False
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value), False
    try:
        return float(str(value).strip().replace(",", ".").replace(" ", "")), True
    except ValueError:
        return None, True


def decimals(x: float) -> int:
    text = repr(x)
    if "e" in text or "E" in text:
        return 99
    return len(text.split(".")[1].rstrip("0")) if "." in text else 0


def draft_fields(columns, rows) -> list[dict]:
    out = []
    total = len(rows)
    for field, kind, title, unit in columns:
        filled = sum(1 for _, r in rows if r[field] is not None and str(r[field]).strip() != "")
        precision, comment = "", ""
        if kind == "number":
            nums = [to_number(r[field]) for _, r in rows]
            as_text = sum(1 for n, was_text in nums if n is not None and was_text)
            dist = collections.Counter(min(decimals(n), 5) for n, _ in nums if n is not None)
            clean = {d: c for d, c in dist.items() if d <= 4}
            if clean:
                precision = str(max(clean.items(), key=lambda dc: (dc[1], -dc[0]))[0])
            parts = [f"{d} зн.: {c}" if d < 5 else f"5+ зн. (похоже на вычисленные): {c}"
                     for d, c in sorted(dist.items())]
            comment = "знаков после запятой в исходнике — " + ", ".join(parts)
            if as_text:
                comment += f"; записано текстом: {as_text}"
        elif kind == "code" and unit:
            comment = f"коды в исходнике: {unit}"
        show = "да" if filled else "нет (пусто у всех)"
        out.append({
            "key": field,
            "excel_header": title,
            "label": LABELS[field],
            "unit": display_unit(unit) if kind == "number" else "",
            "precision": precision,
            "filled": f"{filled}/{total}",
            "show": show,
            "comment": comment,
        })
    return out


# ── Запись ───────────────────────────────────────────────────────────────────

def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding=CSV_ENCODING, newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter=CSV_DELIMITER)
        w.writeheader()
        w.writerows(rows)


def cmd_draft() -> None:
    source = find_source()
    columns, rows = read_sheet(source)
    vm = draft_variety_map(rows)
    fields = draft_fields(columns, rows)
    write_csv(VARIETY_MAP, vm)
    write_csv(FIELDS_CSV, fields)
    by_status = collections.Counter(r["status"] for r in vm)
    print(f"Источник: {source.relative_to(ROOT)} — образцов: {len(rows)}")
    print(f"{VARIETY_MAP.relative_to(ROOT)}: {len(vm)} написаний — " +
          ", ".join(f"{k}: {v}" for k, v in sorted(by_status.items())))
    print(f"{FIELDS_CSV.relative_to(ROOT)}: {len(fields)} полей")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("draft", help="черновики variety-map.csv и fields.csv на утверждение")
    args = parser.parse_args(argv)
    try:
        if args.cmd == "draft":
            cmd_draft()
    except DataError as e:
        print(f"ОШИБКА: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
