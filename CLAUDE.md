# CLAUDE.md — правила работы с репозиторием wine-catalog

Сайт аналитической базы виноматериалов Крыма (ВНИИВиВ «Магарач»):
https://qwentytorantiny73.github.io/wine-catalog/

Владелец учится: коротко объяснять, что и зачем делается.

## Главные правила

1. **Деплой только из `main`.** Сайт собирается и выкладывается только при пуше в `main`. Не пушить в `main` напрямую — только через pull request.
2. **Данные меняются только через `scripts/build_data.py`.** Генерируемые файлы (`src/data/samples.json`, `data/report.md`) руками не править. Источник правды — Excel в `data/source/` и утверждённые таблицы в `data/` (`variety-map.csv`, `fields.csv`, `sample-notes.csv`).
3. **Ничего не придумывать о винах, сортах, показателях и источниках.** Не уверен — пометить «не подтверждено» и спросить владельца. Канонические названия сортов утверждает владелец (`data/variety-map.csv`). Дескриптор аромата без источника (URL, дата обращения) не записывается.
4. **Каждое утверждение в отчёте — с доказательством:** файл:строка или вывод команды.
5. **Не коммитить** токены, пароли, `.env`, исходный Excel (`data/source/`).
6. Две неудачные попытки исправить одно и то же — остановиться и описать проблему.

## Ветки и фазы

- Работа идёт фазами (см. `docs/spec.md`, раздел «Порядок фаз»). Каждая фаза — ветка `phase-N-…` и pull request в `main`.
- Внутри фазы: план → ждать «да» владельца → выполнение → проверка → отчёт → обновить `docs/STATUS.md` и `docs/decisions.md` → остановка.
- **Не создавать ветки `claude/…` и `qwen-code-…`** (старые имена; деплой их не трогает, но путаница не нужна).
- Workflow `static.yml`: на каждый PR — тесты и сборка (проверка до мержа); деплой — только из `main`.
- PR из сессии создать нельзя (нет доступа к GitHub API) — владелец открывает его по ссылке из вывода `git push`.

## Команды

Сайт (Vite, фаза 3):

```bash
npm ci            # установка зависимостей точно по package-lock.json
npm run dev       # локальный сервер разработки: http://localhost:5173/wine-catalog/
npm test          # тесты логики (test/*.test.js)
npm run build     # сборка в dist/ (именно dist/ деплоится)
npm run audit     # сборка + scripts/audit.mjs: Playwright + axe-core на всех страницах, вес /baza/
npm run preview   # посмотреть собранный dist/: http://localhost:4173/wine-catalog/
```

Как устроены страницы (всё вставляется при сборке — страницы работают без JavaScript):
- `src/site/site.js` — **единственный реестр** страниц (`PAGES`), базовый адрес и названия (`SITE`).
  Из него строятся входы сборки, меню, `sitemap.xml` и список страниц для `npm run audit`.
  **Новая страница = HTML-файл + одна строка в `PAGES`.** `hidden: true` — служебная (нет в меню и sitemap, `noindex`).
- Метки в HTML: `<!--@head title="…" description="…"-->`, `<!--@header-->`, `<!--@footer-->`, `<!--@icon имя-->`,
  `<!--@chart years|colors|chromatogram-->`, `<!--@archive-->`, `<!--@external href="…" text="…"-->`.
  Значения: `{{stats.…}}`, `{{site.…}}`, `{{url.baza}}`, `{{base}}`. Неизвестная метка или значение — ошибка сборки.
- CSS: страничный файл (`home.css`, `baza.css`, `arkhiv.css`) сам импортирует `main.css` первым;
  в HTML подключается только страничный. Цвета, радиусы, тени — только токены в `:root` `main.css`.
- Общие понятия (цвета вина, блоки Excel, типы продукции) — `src/lib/domain.js`; колонки таблицы — `src/lib/columns.js`.

Данные (фаза 2). Исходный Excel кладётся в `data/source/` (ровно один `.xlsx`, в git не попадает):

```bash
python3 -m pip install openpyxl           # именно через python3 -m pip: в контейнере несколько версий Python
python3 -I scripts/build_data.py          # сборка → src/data/samples.json, data/report.md
python3 -I scripts/build_data.py draft    # новые сорта/колонки → строки на утверждение (утверждённое не трогает)
python3 -I scripts/build_data.py --source X.xlsx --out /tmp/dir   # проверка на другом файле, без записи в проект
python3 -I scripts/build_aroma.py         # data/aroma-*.csv → src/data/aroma/*.json (Excel не нужен)
python3 -I scripts/build_notes.py         # data/sample-notes.csv → src/data/notes.json (Excel не нужен)
```

CI перед `npm run build` сам запускает `build_aroma.py` и `build_notes.py` — так правки из `/admin/` попадают на сайт.
`/admin/` (Р27) коммитит в `main` только эти два CSV; значения анализов — только через Excel. Инструкция — `docs/admin.md`.

`-I` — изолированный режим Python: Excel приходит извне, поэтому посторонние модули из текущей папки не подгружаются.
CSV для владельца пишутся с разделителем `;` и BOM, чтобы русский Excel открывал их сразу по колонкам.

Цвета графиков проверяются скриптом скилла dataviz (`validate_palette.js`) — не на глаз (решение Р24).

## Документы

- `docs/spec.md` — исходное ТЗ дословно.
- `docs/decisions.md` — решения (Р…) и открытые вопросы (В…).
- `docs/audit.md` — проверка аудита с доказательствами.
- `docs/itog.md` — итоговая проверка: каждый пункт ТЗ, аудита и решений с доказательством.
- `docs/STATUS.md` — где мы сейчас и что нужно от владельца.
- `docs/admin.md` — как войти в `/admin/` (токен GitHub) и что она правит.
- `data/variety-map.csv` — написание сорта в Excel → канонические сорта (утверждает владелец).
- `data/fields.csv` — подпись, единица и точность каждого показателя (утверждает владелец).
- `data/aroma-taxonomy.csv` — утверждённая таксономия ароматов (Р21).
- `data/sample-notes.csv` — пометки к отдельным образцам (номер; поле; текст).
- `data/report.md` — отчёт сборки данных: сводка и что проверить в Excel (генерируется).

## Проверки

- Скриншоты — Playwright на 390 и 1366 px.
- Доступность — axe-core: 0 нарушений critical и serious.
- Вес `/baza/` — не больше 233 КБ переданных байт (замер через CDP `encodedDataLength`, кэш выключен).
