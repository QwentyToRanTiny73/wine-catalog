#!/usr/bin/env python3
"""Сборка данных сайта из исходного Excel.

Исходник: единственный .xlsx в data/source/ (в git не попадает, решение Р3).

Команды:
  python3 -I scripts/build_data.py
      Полная сборка. Проверяет Excel по утверждённым таблицам и пишет:
        src/data/samples.json — данные для сайта (подключается при сборке Vite);
        data/report.md        — сводка и что стоит проверить в Excel.
      Любая ошибка (неизвестный сорт, пустой или повторный номер, неизвестный код…)
      останавливает сборку, и ни один файл не перезаписывается.

  python3 -I scripts/build_data.py draft
      Дополняет data/variety-map.csv и data/fields.csv новыми строками на утверждение
      (новые написания сортов, новые колонки). Утверждённые строки не меняет (решение Р7).

Опции:
  --source FILE   другой Excel вместо data/source/*.xlsx
  --out DIR       куда писать результат (по умолчанию корень репозитория; для проверок)

Утверждённые владельцем таблицы (вход сборки):
  data/variety-map.csv   написание сорта в Excel → канонические сорта (статус «утверждено»)
  data/fields.csv        подпись, единица и точность каждого показателя
  data/sample-notes.csv  пометки к отдельным образцам (номер образца; поле; текст)
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "source"
VARIETY_MAP = ROOT / "data" / "variety-map.csv"
FIELDS_CSV = ROOT / "data" / "fields.csv"
NOTES_CSV = ROOT / "data" / "sample-notes.csv"
OUT_JSON = Path("src/data/samples.json")
OUT_REPORT = Path("data/report.md")

SHEET = "БД"
BLOCK_ROWS = (1, 2, 3)   # объединённые заголовки блоков
HEADER_ROW = 4           # названия колонок
UNIT_ROW = 5             # единицы измерения / расшифровка кодов
FIRST_DATA_ROW = 6
EMPTY_ROWS_TO_STOP = 20  # столько пустых строк подряд — конец данных

APPROVED = "утверждено"
# Образец без лабораторного «Номера» получает внутренний ключ: ROW_KEY_BASE + строка Excel.
# На сайте он показывается как «б/н», номер не выдумывается (решение Р22).
ROW_KEY_BASE = 100_000
CSV_DELIMITER = ";"          # CSV для владельца: «;» и BOM — русский Excel откроет по колонкам
CSV_ENCODING = "utf-8-sig"
BLEND_SEPARATOR = " + "      # разделитель сортов купажа в variety-map.csv

# Значения, введённые руками, редко имеют больше 4 знаков после запятой.
# Больше — это результат формулы (например 4.249454188374997): округляем до
# точности поля из fields.csv. Остальное показываем как введено (решение Р20).
MAX_TYPED_DECIMALS = 4

# Название колонки в Excel (после normalize_header) → ключ поля и тип.
# Колонки ищутся по названию, а не по позиции: вставка колонки ничего не сдвинет.
COLUMNS: dict[str, tuple[str, str]] = {
    "номер": ("labNumber", "id"),            # лабораторный номер — ключ образца, отдельным полем не показывается
    "виноградо-винодельческий район по аввр (2024 г.)": ("wineDistrict", "text"),
    "природно-климатическая зона выращивания винограда": ("climateZone", "text"),
    "природно-климатический район выращивания винограда": ("climateRegion", "text"),
    "административный район выращивания винграда": ("adminRegion", "text"),  # «винграда» — как в исходнике
    "место расположение виноградника (населенный пункт)": ("location", "text"),
    "производитель винограда (хозяйство)": ("grapeProducer", "text"),
    "производитель вина (винодельня)": ("winery", "text"),
    "тип винодельческой продукции": ("productType", "code"),
    "наименование образца": ("name", "text"),
    "сортовой состав": ("varietyRaw", "varieties"),  # на сайте — канонические сорта по variety-map.csv
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

# Написания сортов, утверждённые владельцем (Р10, Р18). Для draft: если сорт
# есть в этом списке, предлагаем именно такое написание.
OWNER_SPELLINGS = [
    "Кефесия", "Эким кара", "Джеват кара", "Кокур белый", "Сары пандас",
    "Бастардо магарачский", "Красень", "Первенец Магарача", "Цитронный Магарача",
]
# Пары, которые владелец назвал разными сортами (Р15): не помечаем как похожие.
DISTINCT_PAIRS = {frozenset({"совиньон белый", "совиньон зеленый"})}
# Значение «Сортового состава», которое означает купаж с неизвестным составом (Р18).
UNKNOWN_BLEND = "купаж"

# Возможные опечатки в текстах: сборку не останавливают, попадают в отчёт.
SUSPICIOUS_TEXT = [("ВННИИВиВ", "возможно, «ВНИИВиВ»"), ("“", "кавычки “ ” вместо \" или « »")]


class DataError(Exception):
    """Ошибка во входных данных: сообщение понятно владельцу, без трассировки."""


@dataclass
class Column:
    index: int
    key: str
    kind: str
    title: str
    unit: str
    block: str
    section: str
    subsection: str


# ── Общие помощники ──────────────────────────────────────────────────────────

def normalize_header(text) -> str:
    s = str(text or "").replace("ё", "е").replace("Ё", "Е").lower()
    return re.sub(r"\s+", " ", s).strip()


def clean_text(value) -> str | None:
    if value is None:
        return None
    s = re.sub(r"\s+", " ", str(value)).strip()
    return s or None


def clean_variety(text: str) -> str:
    """Механическая чистка без смысловых решений: пробелы и пробелы вокруг дефиса."""
    s = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"\s*-\s*", "-", s)


def variety_key(text: str) -> str:
    return clean_variety(text).replace("ё", "е").replace("Ё", "Е").lower()


def split_blend(raw: str) -> list[str]:
    return [clean_variety(p) for p in raw.split(",") if clean_variety(p)]


def display_unit(unit: str) -> str:
    """Только типографика: дм3 → дм³. Смысл единицы не меняется."""
    return unit.strip().replace("дм3", "дм³")


def decimals(x: float) -> int:
    text = repr(float(x))
    if "e" in text or "E" in text:
        return 99
    frac = text.split(".")[1].rstrip("0")
    return len(frac)


def to_number(value):
    """Число из ячейки. Возвращает (число|None, записано_текстом, нераспознано)."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None, False, False
    if isinstance(value, bool):
        return None, False, True
    if isinstance(value, (int, float)):
        return float(value), False, False
    try:
        return float(str(value).strip().replace(",", ".").replace(" ", "").replace(" ", "")), True, False
    except ValueError:
        return None, True, True


def parse_code_legend(text: str) -> dict[str, str]:
    """«б- белое, р- розовое, к - красное» → {'б': 'белое', 'р': 'розовое', 'к': 'красное'}."""
    legend = {}
    for part in str(text or "").split(","):
        if "-" in part:
            code, meaning = part.split("-", 1)
            if code.strip() and meaning.strip():
                legend[code.strip().lower()] = meaning.strip()
    return legend


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def spans(numbers: list[int]) -> str:
    """[19,20,21,42] → «19–21, 42»: короткий список строк Excel."""
    if not numbers:
        return ""
    out, start, prev = [], numbers[0], numbers[0]
    for n in numbers[1:]:
        if n != prev + 1:
            out.append(f"{start}–{prev}" if start != prev else str(start))
            start = n
        prev = n
    out.append(f"{start}–{prev}" if start != prev else str(start))
    return ", ".join(out)


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding=CSV_ENCODING, newline="") as f:
        return list(csv.DictReader(f, delimiter=CSV_DELIMITER))


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding=CSV_ENCODING, newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter=CSV_DELIMITER)
        w.writeheader()
        w.writerows(rows)


def rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


# ── Чтение Excel ─────────────────────────────────────────────────────────────

def find_source(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit)
        if not p.is_file():
            raise DataError(f"Файл не найден: {explicit}")
        return p
    files = sorted(p for p in SOURCE_DIR.glob("*.xlsx") if not p.name.startswith("~$"))
    if len(files) != 1:
        names = ", ".join(p.name for p in files) or "нет файлов"
        raise DataError(f"В {rel(SOURCE_DIR)}/ должен лежать ровно один .xlsx, сейчас: {names}")
    return files[0]


def block_titles(ws, max_col: int) -> dict[tuple[int, int], str]:
    """(строка, колонка) → заголовок блока с учётом объединённых ячеек."""
    titles = {}
    for rng in ws.merged_cells.ranges:
        if rng.min_row > max(BLOCK_ROWS):
            continue
        value = clean_text(ws.cell(rng.min_row, rng.min_col).value)
        if not value:
            continue
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                titles[(r, c)] = value
    for r in BLOCK_ROWS:
        for c in range(1, max_col + 1):
            value = clean_text(ws.cell(r, c).value)
            if value and (r, c) not in titles:
                titles[(r, c)] = value
    return titles


def read_sheet(path: Path):
    """Возвращает (columns, rows): rows — список (номер строки Excel, {ключ: сырое значение})."""
    wb = openpyxl.load_workbook(path, data_only=True)
    if SHEET not in wb.sheetnames:
        raise DataError(f"В файле {path.name} нет листа «{SHEET}». Листы: {', '.join(wb.sheetnames)}")
    ws = wb[SHEET]

    header = [c.value for c in ws[HEADER_ROW]]
    units = [c.value for c in ws[UNIT_ROW]]
    found, unknown = {}, []
    for idx, title in enumerate(header):
        if title is None:
            continue
        key = normalize_header(title)
        if key not in COLUMNS:
            unknown.append(f"колонка {idx + 1}: «{title}»")
            continue
        found[idx] = key

    missing = sorted({k for k, _ in COLUMNS.values()} - {COLUMNS[k][0] for k in found.values()})
    if unknown or missing:
        lines = []
        if unknown:
            lines.append("Неизвестные колонки (добавьте их в COLUMNS в scripts/build_data.py):")
            lines += [f"  - {u}" for u in unknown]
        if missing:
            lines.append("Не найдены ожидаемые колонки: " + ", ".join(missing))
        raise DataError("\n".join(lines))

    titles = block_titles(ws, max(found) + 1)
    columns = []
    for idx, key in found.items():
        field, kind = COLUMNS[key]
        unit = clean_text(units[idx]) if idx < len(units) else None
        level = [titles.get((r, idx + 1), "") for r in BLOCK_ROWS]
        block = level[0]
        section = level[1] if level[1] != block else ""
        subsection = level[2] if level[2] not in (block, section) else ""
        columns.append(Column(idx, field, kind, clean_text(header[idx]) or "", unit or "",
                              block, section, subsection))

    rows, empty_streak = [], 0
    last = max(found) + 1
    for excel_row, values in enumerate(
        ws.iter_rows(min_row=FIRST_DATA_ROW, max_col=last, values_only=True), start=FIRST_DATA_ROW
    ):
        if all(v is None or str(v).strip() == "" for v in values):
            empty_streak += 1
            if empty_streak >= EMPTY_ROWS_TO_STOP:
                break
            continue
        empty_streak = 0
        rows.append((excel_row, {c.key: values[c.index] for c in columns}))
    return columns, rows


# ── Утверждённые таблицы ─────────────────────────────────────────────────────

def load_variety_map(errors: list[str]) -> dict[str, list[str]]:
    """clean_variety(raw) → список канонических сортов. Только утверждённые строки."""
    rows = read_csv(VARIETY_MAP)
    if not rows:
        errors.append(f"Нет {rel(VARIETY_MAP)}. Создайте черновик: python3 -I scripts/build_data.py draft")
        return {}
    mapping: dict[str, list[str]] = {}
    for r in rows:
        key = clean_variety(r["raw"])
        names = [n.strip() for n in r["varieties"].split(BLEND_SEPARATOR.strip()) if n.strip()]
        if r["status"].strip() != APPROVED:
            errors.append(f"{rel(VARIETY_MAP)}: строка «{r['raw']}» не утверждена (статус «{r['status']}»)")
            continue
        if key in mapping and mapping[key] != names:
            errors.append(f"{rel(VARIETY_MAP)}: для «{key}» разные сорта в разных строках")
        mapping[key] = names
    return mapping


def load_fields(columns: list[Column], errors: list[str]) -> dict[str, dict]:
    rows = {r["key"]: r for r in read_csv(FIELDS_CSV)}
    if not rows:
        errors.append(f"Нет {rel(FIELDS_CSV)}. Создайте черновик: python3 -I scripts/build_data.py draft")
        return {}
    config = {}
    for col in columns:
        r = rows.get(col.key)
        if r is None:
            errors.append(f"{rel(FIELDS_CSV)}: нет строки для поля {col.key} («{col.title}») — запустите draft")
            continue
        precision = None
        if col.kind == "number":
            if col.unit and display_unit(col.unit) != r["unit"].strip():
                errors.append(f"{rel(FIELDS_CSV)}: у поля {col.key} единица «{r['unit']}», "
                              f"а в Excel теперь «{col.unit}» — проверьте и обновите")
            try:
                precision = int(r["precision"])
            except ValueError:
                errors.append(f"{rel(FIELDS_CSV)}: у поля {col.key} не задана точность (precision)")
        config[col.key] = {
            "label": r["label"].strip(),
            "unit": r["unit"].strip(),
            "precision": precision,
            "show": r["show"].strip().lower().startswith("да"),
        }
    return config


def load_notes(errors: list[str]) -> dict[int, list[dict]]:
    notes: dict[int, list[dict]] = collections.defaultdict(list)
    for r in read_csv(NOTES_CSV):
        try:
            number = int(r["labNumber"])
        except ValueError:
            errors.append(f"{rel(NOTES_CSV)}: номер образца «{r['labNumber']}» — не число")
            continue
        notes[number].append({"field": r["field"].strip(), "text": r["note"].strip()})
    return notes


# ── Сборка ───────────────────────────────────────────────────────────────────

def build(columns: list[Column], rows, source: Path):
    errors: list[str] = []
    variety_map = load_variety_map(errors)
    fields = load_fields(columns, errors)
    notes = load_notes(errors)
    by_key = {c.key: c for c in columns}
    legends = {c.key: parse_code_legend(c.unit) for c in columns if c.kind == "code"}

    issues = collections.defaultdict(list)   # не ошибки — пойдут в отчёт
    unknown_varieties = collections.defaultdict(list)
    numbers_seen = collections.defaultdict(list)
    samples = []

    for excel_row, raw in rows:
        s: dict = {}
        for col in columns:
            v = raw[col.key]
            if col.kind in ("text", "varieties"):
                s[col.key] = clean_text(v)
                for needle, hint in SUSPICIOUS_TEXT:
                    if s[col.key] and needle in s[col.key]:
                        issues[f"текст «{needle}» в поле «{col.title}» ({hint})"].append(excel_row)
            elif col.kind in ("int", "id"):
                n, as_text, bad = to_number(v)
                if bad or (n is not None and not float(n).is_integer()):
                    errors.append(f"Строка {excel_row}, «{col.title}»: «{v}» — не целое число")
                    n = None
                s[col.key] = int(n) if n is not None else None
            elif col.kind == "code":
                code = clean_text(v)
                if code is None:
                    s[col.key] = None
                elif code.lower() in legends[col.key]:
                    s[col.key] = legends[col.key][code.lower()]
                else:
                    errors.append(f"Строка {excel_row}, «{col.title}»: неизвестный код «{code}» "
                                  f"(допустимо: {col.unit})")
                    s[col.key] = None
            else:  # number
                n, as_text, bad = to_number(v)
                if bad:
                    errors.append(f"Строка {excel_row}, «{col.title}»: «{v}» — не число")
                    n = None
                if n is not None:
                    if as_text:
                        issues[f"«{col.title}»: число записано текстом"].append(excel_row)
                    if decimals(n) > MAX_TYPED_DECIMALS:
                        # 36.760000000000005 — это введённое 36.76 с погрешностью хранения: снимаем шум
                        n = round(n, 10)
                    if decimals(n) > MAX_TYPED_DECIMALS and fields.get(col.key, {}).get("precision") is not None:
                        n = round(n, fields[col.key]["precision"])
                        issues[f"«{col.title}»: длинная дробная часть (результат формулы), "
                               f"округлено до {fields[col.key]['precision']} зн."].append(excel_row)
                    n = int(n) if float(n).is_integer() else n
                s[col.key] = n

        number = s.pop("labNumber")
        if number is None:
            issues["«Номер» не заполнен — на сайте образец показан как «б/н» (Р22)"].append(excel_row)
            sample_id = ROW_KEY_BASE + excel_row
        else:
            numbers_seen[number].append(excel_row)
            sample_id = number
        s = {"id": sample_id, "labNumber": number, **s}

        if s["harvestYear"] is not None and not 1900 <= s["harvestYear"] <= 2100:
            errors.append(f"Строка {excel_row}: год урожая {s['harvestYear']} вне диапазона 1900–2100")

        raw_variety = "" if raw["varietyRaw"] is None else str(raw["varietyRaw"])
        key = clean_variety(raw_variety)
        if key not in variety_map:
            unknown_varieties[raw_variety].append(excel_row)
            names = []
        else:
            names = variety_map[key]
        s["varieties"] = names
        s["blend"] = len(names) > 1 or variety_key(raw_variety) == UNKNOWN_BLEND
        if not names:
            label = "купаж, состав неизвестен" if s["blend"] else "сорт не указан"
            issues[f"Сортовой состав: {label}"].append(excel_row)

        if number is not None and number in notes:
            s["notes"] = notes[number]
        samples.append((excel_row, s))

    for number, where in numbers_seen.items():
        if len(where) > 1:
            errors.append(f"Номер образца {number} повторяется в строках {', '.join(map(str, where))}")
    if any(n >= ROW_KEY_BASE for n in numbers_seen):
        errors.append(f"«Номер» образца ≥ {ROW_KEY_BASE} пересекается с внутренними ключами (Р22)")
    for raw_variety, where in unknown_varieties.items():
        errors.append(f"Неизвестный сорт «{raw_variety}» (строки Excel {spans(where)}): добавьте строку в "
                      f"{rel(VARIETY_MAP)} командой draft и утвердите её")
    # Поля, которые попадут на сайт: показаны в fields.csv и заполнены хотя бы у одного образца
    filled = {c.key: sum(1 for _, s in samples if s.get(c.key) is not None) for c in columns}
    shown = {c.key for c in columns
             if c.kind != "id" and fields.get(c.key, {}).get("show") and filled[c.key]}

    known_numbers = {s["labNumber"] for _, s in samples if s["labNumber"] is not None}
    for number, items in notes.items():
        if number not in known_numbers:
            errors.append(f"{rel(NOTES_CSV)}: образца с номером {number} нет в Excel")
        for item in items:
            if item["field"] not in by_key:
                errors.append(f"{rel(NOTES_CSV)}: у образца {number} неизвестное поле «{item['field']}»")
            elif item["field"] not in shown:
                # пометка к скрытому или служебному полю на сайте не видна — лучше сказать сразу
                errors.append(f"{rel(NOTES_CSV)}: у образца {number} пометка к полю «{item['field']}», "
                              "которое не показывается на сайте")

    if errors:
        raise DataError("Сборка остановлена:\n" + "\n".join(f"  - {e}" for e in errors))

    field_list = []
    for c in columns:
        if c.key not in shown:
            continue
        cfg = fields[c.key]
        field_list.append({
            "key": c.key, "label": cfg["label"], "unit": cfg["unit"], "type": c.kind,
            "precision": cfg["precision"], "block": c.block, "section": c.section,
            "subsection": c.subsection, "filled": filled[c.key],
        })
    # Скрытые поля (show = «нет») не публикуются вовсе — их значений нет и в samples.json
    keep = shown | {"id", "labNumber", "varieties", "blend", "notes"}
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    data = {
        "source": {"file": source.name, "sha256": digest, "sheet": SHEET, "rows": len(samples)},
        "fields": field_list,
        "samples": [{k: v for k, v in s.items() if v is not None and k in keep} for _, s in samples],
    }
    return data, issues, filled


# ── Вывод ────────────────────────────────────────────────────────────────────

def report_md(data: dict, issues: dict, filled: dict, columns: list[Column], fields: list[dict]) -> str:
    samples = data["samples"]
    total = len(samples)
    src = data["source"]
    out = [
        "# Отчёт сборки данных",
        "",
        "Файл сгенерирован `scripts/build_data.py` — руками не править.",
        "",
        f"- Источник: `{src['file']}`, лист «{src['sheet']}», SHA-256 `{src['sha256'][:16]}…`",
        f"- Образцов: **{total}**",
    ]
    for key, title in (("color", "Цвет"), ("productType", "Тип продукции")):
        c = collections.Counter(s.get(key) or "не указан" for s in samples)
        out.append(f"- {title}: " + ", ".join(f"{k} — {v}" for k, v in c.most_common()))
    years = collections.Counter(s.get("harvestYear") for s in samples)
    out.append("- Годы урожая: " + ", ".join(f"{y} — {n}" for y, n in sorted(years.items())))

    mono = collections.Counter(s["varieties"][0] for s in samples if len(s["varieties"]) == 1)
    in_blend = collections.Counter(v for s in samples if len(s["varieties"]) > 1 for v in s["varieties"])
    names = sorted(set(mono) | set(in_blend))
    out += ["", f"## Сорта ({len(names)}, по утверждённой `data/variety-map.csv`)", "",
            "| Сорт | Моносортовых образцов | В купажах |", "|---|---:|---:|"]
    out += [f"| {n} | {mono.get(n, 0)} | {in_blend.get(n, 0)} |" for n in names]

    shown = {f["key"] for f in fields}
    out += ["", "## Поля", "", "| Поле | Подпись на сайте | Единица | Заполнено | На сайте |", "|---|---|---|---:|---|"]
    for c in columns:
        if c.kind == "id":
            continue
        cfg = next((f for f in fields if f["key"] == c.key), None)
        label = cfg["label"] if cfg else ""
        unit = cfg["unit"] if cfg else ""
        on_site = "да" if c.key in shown else "нет"
        out.append(f"| `{c.key}` | {label} | {unit} | {filled[c.key]}/{total} | {on_site} |")

    out += ["", "## Проверьте в Excel", "",
            "Эти находки сборку не останавливают. Исправлять — в исходном Excel, затем пересобрать.", ""]
    if issues:
        for title, where in sorted(issues.items()):
            out.append(f"- {title}: {len(where)} — строки {spans(sorted(set(where)))}")
    else:
        out.append("- замечаний нет")

    noted = [s for s in samples if s.get("notes")]
    out += ["", "## Пометки к образцам (`data/sample-notes.csv`)", ""]
    out += [f"- № {s['labNumber']}, поле `{n['field']}`: {n['text']}" for s in noted for n in s["notes"]] or ["- нет"]
    return "\n".join(out) + "\n"


def write_outputs(out_dir: Path, data: dict, issues, filled, columns) -> list[Path]:
    paths = []
    for rel_path, text in (
        (OUT_JSON, json.dumps(data, ensure_ascii=False, indent=1) + "\n"),
        (OUT_REPORT, report_md(data, issues, filled, columns, data["fields"])),
    ):
        p = out_dir / rel_path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        paths.append(p)
    return paths


# ── draft: черновики на утверждение ─────────────────────────────────────────

def draft_variety_rows(rows) -> list[dict]:
    raw_rows: dict[str, list[int]] = collections.defaultdict(list)
    spellings: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for excel_row, rec in rows:
        raw = "" if rec["varietyRaw"] is None else str(rec["varietyRaw"])
        raw_rows[raw].append(excel_row)
        if variety_key(raw) == UNKNOWN_BLEND:
            continue
        for part in split_blend(raw):
            spellings[variety_key(part)][part] += 1

    owner = {variety_key(s): s for s in OWNER_SPELLINGS}

    def canonical(key: str) -> tuple[str, list[str]]:
        seen = spellings[key]
        doubts = []
        if key in owner:
            name = owner[key]
            if name not in seen:
                doubts.append(f"в данных пишется «{seen.most_common(1)[0][0]}», утверждено «{name}»")
        else:
            name = seen.most_common(1)[0][0]
        if len(seen) > 1:
            doubts.append("разные написания: " + ", ".join(f"«{s}» ×{n}" for s, n in seen.most_common()))
        for other in spellings:
            if other != key and frozenset({key, other}) not in DISTINCT_PAIRS \
                    and min(len(key), len(other)) >= 5 and edit_distance(key, other) <= 1:
                doubts.append(f"похоже на «{spellings[other].most_common(1)[0][0]}» — один сорт или разные?")
        return name, doubts

    out = []
    for raw, excel_rows in sorted(raw_rows.items(), key=lambda kv: variety_key(kv[0])):
        parts = [] if variety_key(raw) == UNKNOWN_BLEND else split_blend(raw)
        names, doubts, basis = [], [], []
        for part in parts:
            name, d = canonical(variety_key(part))
            names.append(name)
            doubts += d
            if name != part:
                basis.append(f"«{part}» → «{name}»")
        if raw.strip() == "":
            status, comment = "пусто", "сорт не указан в исходнике — известен ли он?"
        elif variety_key(raw) == UNKNOWN_BLEND:
            status, comment = "спорно", "состав купажа не указан — известны ли сорта?"
        elif doubts:
            status, comment = "спорно", "; ".join(dict.fromkeys(doubts))
        else:
            status, comment = "предложено", ""
        if len(names) > 1:
            basis.append("купаж: порядок сортов как в исходнике")
        if raw.strip() and raw != clean_variety(raw):
            basis.append("убраны лишние пробелы")
        out.append({"raw": raw, "count": len(excel_rows), "varieties": BLEND_SEPARATOR.join(names),
                    "status": status, "basis": "; ".join(basis), "comment": comment,
                    "excel_rows": spans(excel_rows)})
    return out


LABELS = {
    "labNumber": "Номер образца", "wineDistrict": "Виноградо-винодельческий район (АВВР, 2024)",
    "climateZone": "Природно-климатическая зона", "climateRegion": "Природно-климатический район",
    "adminRegion": "Административный район", "location": "Населённый пункт",
    "grapeProducer": "Производитель винограда", "winery": "Производитель вина",
    "productType": "Тип продукции", "name": "Наименование образца", "varietyRaw": "Сортовой состав",
    "harvestYear": "Год урожая", "color": "Цвет", "alcohol": "Объёмная доля этилового спирта",
    "reducedExtract": "Приведённый экстракт", "titratedAcidity": "Титруемая кислотность",
    "sugar": "Сахара", "citricAcid": "Лимонная кислота", "tartaricAcid": "Винная кислота",
    "malicAcid": "Яблочная кислота", "succinicAcid": "Янтарная кислота", "lacticAcid": "Молочная кислота",
    "aceticAcid": "Уксусная кислота", "bioses": "Биозы (в пересчёте на сахарозу)", "glucose": "Глюкоза",
    "fructose": "Фруктоза", "glycerin": "Глицерин", "chlorides": "Хлориды", "sodium": "Натрий",
    "potassium": "Калий", "magnesium": "Магний", "calcium": "Кальций",
    "phenolicSubstances": "Сумма фенольных веществ", "ph": "pH",
    "bufferCapacity": "Буферная ёмкость (щелочью)", "electricConductivity": "Электропроводность",
}


def draft_field_rows(columns: list[Column], rows) -> list[dict]:
    out, total = [], len(rows)
    for col in columns:
        filled = sum(1 for _, r in rows if r[col.key] is not None and str(r[col.key]).strip() != "")
        precision, comment = "", ""
        if col.kind == "number":
            nums = [to_number(r[col.key]) for _, r in rows]
            as_text = sum(1 for n, t, _ in nums if n is not None and t)
            dist = collections.Counter(min(decimals(n), 5) for n, _, _ in nums if n is not None)
            clean = {d: c for d, c in dist.items() if d <= MAX_TYPED_DECIMALS}
            if clean:
                precision = str(max(clean.items(), key=lambda dc: (dc[1], -dc[0]))[0])
            comment = "знаков после запятой в исходнике — " + ", ".join(
                f"{d} зн.: {c}" if d < 5 else f"5+ зн. (похоже на вычисленные): {c}" for d, c in sorted(dist.items()))
            if as_text:
                comment += f"; записано текстом: {as_text}"
        elif col.kind == "code" and col.unit:
            comment = f"коды в исходнике: {col.unit}"
        out.append({"key": col.key, "excel_header": col.title, "label": LABELS.get(col.key, col.title),
                    "unit": display_unit(col.unit) if col.kind == "number" else "", "precision": precision,
                    "filled": f"{filled}/{total}", "show": "да" if filled else "нет (пусто у всех)",
                    "comment": comment})
    return out


def merge_rows(path: Path, draft: list[dict], key) -> tuple[list[dict], int]:
    """Утверждённые строки не трогаем, новые дописываем. Возвращает (строки, сколько добавлено)."""
    existing = read_csv(path)
    if not existing:
        return draft, len(draft)
    known = {key(r) for r in existing}
    added = [r for r in draft if key(r) not in known]
    fresh = {key(r): r for r in draft}
    for r in existing:  # справочные колонки обновляем, решения — нет
        d = fresh.get(key(r))
        for info in ("count", "excel_rows", "filled"):
            if d and info in r and info in d:
                r[info] = d[info]
    return existing + added, len(added)


def cmd_draft(source_arg: str | None) -> None:
    source = find_source(source_arg)
    columns, rows = read_sheet(source)
    vm, vm_added = merge_rows(VARIETY_MAP, draft_variety_rows(rows), lambda r: clean_variety(r["raw"]))
    fields, f_added = merge_rows(FIELDS_CSV, draft_field_rows(columns, rows), lambda r: r["key"])
    write_csv(VARIETY_MAP, vm)
    write_csv(FIELDS_CSV, fields)
    print(f"Источник: {rel(source)} — образцов: {len(rows)}")
    print(f"{rel(VARIETY_MAP)}: добавлено новых строк на утверждение: {vm_added}")
    print(f"{rel(FIELDS_CSV)}: добавлено новых полей на утверждение: {f_added}")


def cmd_build(source_arg: str | None, out_dir: Path) -> None:
    source = find_source(source_arg)
    columns, rows = read_sheet(source)
    data, issues, filled = build(columns, rows, source)
    paths = write_outputs(out_dir, data, issues, filled, columns)
    print(f"Источник: {rel(source)} — образцов: {len(data['samples'])}, полей на сайте: {len(data['fields'])}")
    for p in paths:
        print(f"  записан {rel(p)}")
    if issues:
        print(f"Замечаний для проверки в Excel: {len(issues)} (см. {OUT_REPORT})")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("cmd", nargs="?", choices=["build", "draft"], default="build")
    parser.add_argument("--source", help="путь к Excel вместо data/source/*.xlsx")
    parser.add_argument("--out", type=Path, default=ROOT, help="куда писать результат сборки")
    args = parser.parse_args(argv)
    try:
        if args.cmd == "draft":
            cmd_draft(args.source)
        else:
            cmd_build(args.source, args.out)
    except DataError as e:
        print(f"ОШИБКА: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
