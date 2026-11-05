# Проверка аудита (фаза 0)

- Дата: 2026-11-05. Коммит: `dd61495` (ветка по умолчанию `qwen-code-93ce8202-…`).
- Живой сайт побайтно совпадает с этим коммитом: md5 файлов `index.html`, `baza/index.html`, `js/baza.js`, `js/data.js`, `data/table.js`, `arkhiv/index.html`, `style.css` локально и на `qwentytorantiny73.github.io/wine-catalog/` одинаковы. Поэтому интерфейс проверялся прямо на проде.
- Инструменты: `grep`/`sed` по коду, Node (загрузка `js/data.js`), `npm audit`, Playwright + axe-core 4.10.2 (1366 и 390 px), Chrome DevTools Protocol (`encodedDataLength`) для веса страниц, `curl` для проверки доступности файлов на проде.

Обозначения: ✅ подтверждено · ⚠️ подтверждено частично · ❌ не подтверждено.

## Безопасность

| № | Вердикт | Доказательство |
|---|---------|----------------|
| Б1 | ✅ и хуже, чем в ТЗ | `js/baza.js:9-10` — `ADMIN_LOGIN = ''`, `ADMIN_PASSWORD = ''`; проверка `js/baza.js:388` `u === ADMIN_LOGIN && p === ADMIN_PASSWORD`. Форма `baza/index.html:166` (`id="loginPass"`). Прежний пароль добавлен в коммите `dc4e694` (`git log -S ADMIN_PASSWORD -p -- js/baza.js`); значение здесь не повторяю. **Сверх ТЗ:** при пустых константах `'' === ''` истинно — «админом» становится любой, кто нажмёт «Войти» с пустыми полями (см. Н1) |
| Б2 | ✅ | `admin_login.html:52` — `username === 'admin' && password === 'admin123'`. Файл доступен на проде: `curl …/admin_login.html` → `200` |
| Б3 | ✅ | `js/baza.js:142-151` (`localStorage` ключ `mgr_extra_samples`), `admin_panel.html:427` и `js/script.js:419` (`localStorage.setItem('wineSamples', …)`). Данные остаются в браузере того, кто их ввёл |
| Б4 | ✅ | `baza/index.html:8`, `catalog.html:8` — `https://unpkg.com/xlsx/dist/xlsx.full.min.js` без версии; `curl -I` → `302 location: /xlsx@0.18.5/…`. `npm audit`: `xlsx high GHSA-4r6h-8v6p-xvw6 Prototype Pollution, range <0.19.3` (CVE-2023-30533) и `xlsx high GHSA-5pgg-2g8v-p4x9 ReDoS, range <0.20.2` (CVE-2024-22363). Важно: `npm view xlsx version` → `0.18.5` — исправленных версий в реестре npm нет (см. вопрос В2 в `decisions.md`) |
| Б5 | ✅ | `.github/workflows/static.yml:7-10` — `branches: main, "qwen-code-*", "claude/**"`. Эти триггеры добавлены коммитом `2301cea` в прошлой сессии, чтобы починить деплой при отсутствии `main` |
| Б6 | ✅ | `static.yml:43` `path: '.'`. На проде отдаются: `wine-catalog-updated.tar.gz` → 200 (22 924 Б), `data/analytical_data.xlsx` → 200 (38 303 Б), `admin_login.html` → 200, `package.json` → 200. Файлы с точкой (`.github/…`) → 404. В архиве: `app.js`, `data.json` (75 КБ), `convert_excel_to_json.py`, `index.html`, `styles.css`, `README.md` |

## Данные

Счёт по `js/data.js` (190 записей, id уникальны).

| № | Вердикт | Доказательство |
|---|---------|----------------|
| Д1 | ✅ | 38 различных непустых значений `sort` + пункт «Все сорта» = 39 вариантов в фильтре (`js/baza.js:177`, `baza/index.html:67`). «Джеват Кара» ×3 / «Джеват кара» ×1; «Кефессия» ×5 + 1 в купаже «Эким кара, Кефессия» = 6; «Кефесия» ×1 (в купаже «Каберне -Совиньон, Кефесия»); двойной пробел «Каберне-Совиньон,  Мерло»; порядок «Каберне-Совиньон, Мерло» и «Мерло, Каберне-Совиньон». Механическая нормализация (регистр, пробелы, разбор купажей, без объединения синонимов) → 30 названий; если объединить «Кефесия/Кефессия» → 29. **Сверх ТЗ:** «Каберне -Совиньон» — пробел перед дефисом |
| Д2 | ✅ | 9 значений с запятой, 6 `null`, 1 «купаж». Фильтр сравнивает строку целиком: `js/baza.js:217` `s.sort !== sort` — купаж «Каберне-Совиньон, Мерло» не найдётся по «Мерло» |
| Д3 | ✅ | `researchDate` непуст у 0 из 190. Поле в `ORG_FIELDS` (`js/baza.js:27`), пустое выводится как «н/д» (`js/baza.js:352`) |
| Д4 | ✅ | `winery == "микровиноделие"` у 132 образцов. «ВННИИВиВ "Магарач" РАН» у образцов 102, 103, 152. **Сверх ТЗ:** кавычки разных типов — «ООО “ВК Сатера”» рядом с «ООО "…"» |
| Д5 | ✅ | `git ls-files` содержит только `data/analytical_data.xlsx`; в нём 137 непустых строк (4 строки шапки + 133 образца). Файла на 190 образцов в репозитории нет |
| Д6 | ✅ | Знаков после точки у pH: 0 → 1 образец, 1 → 48, 2 → 77, 3 → 63. pH 4.008 у образца 93, pH 3.89 у образцов 15 и 31. Спирт: 0/1/2/4 знака (4 знака — 5 образцов) |

## Архитектура

| № | Вердикт | Доказательство |
|---|---------|----------------|
| А1 | ✅ | `index.html:10-12` → `js/data.js` + `data/table.js`; `baza/index.html:8,279` → SheetJS + `js/data.js` + `js/baza.js`; `catalog.html:8-10` → SheetJS, `docx@7.1.0`, `file-saver@2.0.5` + `js/script.js`; отдельно `admin_login.html`, `admin_panel.html` |
| А2 | ✅ | `class="site-header"` и `<footer>` повторены в `index.html`, `baza/index.html`, `arkhiv/index.html`; у `catalog.html`, `admin_*.html` свои варианты |
| А3 | ✅ | `wc -c js/data.js` → 193 667 Б (≈ 189 КиБ). `?v=4` вручную: `index.html:10,12`, `arkhiv/index.html:137`. **Сверх ТЗ:** `baza/index.html:279` подключает `../js/data.js` **без** `?v=` — `/baza/` может показывать данные из старого кэша |
| А4 | ✅ | CDP, `/baza/`, кэш выключен: всего 474 КБ за 10 запросов, из них `xlsx@0.18.5` 307 КБ (65 %). Расхождение с 467 КБ — сетевой шум |
| А5 | ⚠️ | Количество подтверждено: 11 `innerHTML` в `js/baza.js` (строки 259, 265, 292, 303, 332, 339, 340, 341, 413, 530, 560). «Без экранирования» — **не подтверждено**: текст идёт через `esc()` (`js/baza.js:703`), числа через `fmt()` (`:709-712`, тоже `esc`) или `parseInt` (`:426`, `:513`). Без экранирования вставляются только числа (id, год, номера страниц). Сейчас XSS не нашёл, но защита держится на дисциплине; переход на `textContent` по ТЗ остаётся нужным |
| А6 | ✅ | Два workflow: `jekyll-gh-pages.yml`, `static.yml`. `git ls-remote --heads origin main` → пусто. `git ls-remote --symref origin HEAD` → `qwen-code-93ce8202-…`. Ещё 5 веток: `claude/wine-catalog-rebuild-9Vyg2`, `feature/table-update-from-excel`, `qwen-code-116694a7-…`, `qwen-code-9f207c8b-…`, `qwen-code-ce21af45-…` |
| А7 | ✅ | `.gitignore` — одна строка прозы («Nothing should be ignored…»). `file README.md` → `UTF-16, little-endian text, with CRLF`, содержимое — `# wine-catalog`. Файлы `IMPLEMENTATION_SUMMARY.md`, `recommendations.md`, `ADMIN_FEATURES.md`, `wine-catalog-updated.tar.gz` есть |
| А8 | ✅ | `style="` на страницах: `baza/index.html` 30, `catalog.html` 15, `arkhiv/index.html` 12, `admin_panel.html` 11, `index.html` 4. Одинаковые цвета в двух наборах переменных: `style.css:11,15,18` (`--wine-main`, `--cream`, `--gold`) и `data/table.css:8,11,14` (`--tw-wine`, `--tw-cream`, `--tw-gold`) |

## Интерфейс

axe-core на проде, 1366 и 390 px (результаты одинаковы на обеих ширинах).

| № | Вердикт | Доказательство |
|---|---------|----------------|
| И1 | ✅ | axe `critical: select-name`: `/` — 3 узла (`filterYear`, `filterColor`, `filterRegion`), `/baza/` — 5 (всего 7 select без подписи, 2 в скрытой форме) |
| И2 | ✅ | axe `moderate: landmark-one-main` на `/`, `/baza/`, `/arkhiv/`; `serious: color-contrast` — 1 узел на `/`. (Также `moderate: region`: 251 узел на `/`, 13 на `/baza/`) |
| И3 | ✅ | `[aria-sort]` — 0 элементов на `/` и `/baza/`; фокусируемых заголовков (`th[tabindex]`, `th button`) — 0. Сортировка только по `click`: `data/table.js:334`, `js/baza.js:643` |
| И4 | ✅ | `data/table.js:157`, `js/baza.js:243`: `null` → `''`, затем `localeCompare` — пустая строка меньше любой. На данных: сортировка по натрию ↑ — первые 167 строк пустые. Порядок самих чисел при этом не ломается (проверено: 0 инверсий) |
| И5 | ✅ | 390 px: таблица 887 px в контейнере 390 px (`/`), 1005 px в 348 px (`/baza/`) — прокрутка внутри блока; сама страница вбок не едет. У `catalog.html` едет вся страница (895 > 390) |
| И6 | ✅ | `js/baza.js:268` — `esc(s.name \|\| s.sort \|\| '—')`; название заполнено только у 36 из 190 образцов |
| И7 | ✅ | Эмодзи: `index.html` 16, `baza/index.html` 22, `arkhiv/index.html` 10 (🍷🔬📊🏛🔍 и др.) |
| И8 | ✅ | `meta[name=description]` и `meta[property^="og:"]` отсутствуют на всех 6 страницах |

## Что пропущено в ТЗ (новые находки)

| № | Важность | Находка | Доказательство |
|---|----------|---------|----------------|
| Н1 | критично | Вход в «админку» `/baza/` открыт всем: пустой логин и пароль совпадают с пустыми константами | `js/baza.js:9-10, 384-389` |
| Н2 | высокая | Права «админа» — только флаг в `localStorage`; его ставят из DevTools без пароля | `js/baza.js:376` (`mgr_admin_auth`), `admin_panel.html:328` (`isAdminLoggedIn`) |
| Н3 | высокая | При создании `main` сработают **оба** workflow (оба слушают `main`) и будут гоняться за одно окружение `github-pages`; Jekyll-сборка обрабатывает файлы иначе. Jekyll-workflow нужно удалить **до** создания `main` | `jekyll-gh-pages.yml:7`, `static.yml:8` |
| Н4 | средняя | `package.json` объявляет `docx`, `file-saver`, `xlsx`, но ни одна страница не берёт их из npm (только с unpkg). `docx` тянет `nanoid` с двумя уязвимостями high (GHSA-28wg-ghj8-5hjv, GHSA-xwg4-73v4-xw9w) | `package.json:2-6`, `npm audit` |
| Н5 | средняя | Сторонние скрипты без SRI (`integrity`), шрифты Google с чужого домена: 126 КБ шрифтов на `/baza/` — это больше половины целевого бюджета 233 КБ | CDP-замер `/baza/`; решается Р8 (`@fontsource`) |
| Н6 | средняя | `/baza/` не сбрасывает кэш данных | `baza/index.html:279` |
| Н7 | данные | Натрий, калий, магний пусты у 167 из 190 образцов, хлориды — у 87, кальций — у 69. Правило «пустые у всех — не показывать» скроет только `researchDate`; для редких полей нужен отдельный вид | счёт по `js/data.js` |
| Н8 | данные | «микровиноделие» — способ производства, а не производитель; в колонке «Производитель» это вводит в заблуждение | `winery` у 132 образцов |
| Н9 | вопрос | Образец 29 (Саперави, 2018): спирт 1.4 % об., сахара 3.55 г/дм³ — требует сверки с исходником (В4) | `js/data.js`, id 29 |
| Н10 | инфо | Создавать PR из этой сессии нельзя: GitHub-коннектор не авторизован, `gh auth status` → «token in GH_TOKEN is invalid». Ветки пушатся, PR открывает владелец по ссылке из `git push` | вывод `gh auth status` |
