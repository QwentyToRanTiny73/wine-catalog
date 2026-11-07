#!/usr/bin/env node
// Автопроверка сайта: npm run audit  (сначала собирает dist/, затем проверяет его)
//
// На каждой странице, на ширине 390 и 1366 px:
//   - axe-core: 0 нарушений critical и serious (WCAG 2.2 A/AA);
//   - нет ошибок JavaScript и битых запросов; страница не прокручивается вбок.
// На /baza/: сортировка с клавиатуры и aria-sort, карточка образца (<dialog>):
//   фокус внутри, Esc закрывает, фокус возвращается; axe с открытой карточкой.
// Вес /baza/: не больше 233 КБ переданных байт (CDP, кэш выключен, gzip как на GitHub Pages).
// Колесо ароматов: всё, что /aromaty/ грузит сверх общего с главной, — не больше 50 КБ.
//
// Опции:
//   --url https://…/wine-catalog/   проверить живой сайт вместо локального dist/
//   --shots ПАПКА                    сохранить скриншоты страниц на 390 и 1366 px
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { BASE, PAGES } from '../src/site/site.js';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const WIDTHS = [390, 1366];
const WEIGHT_LIMIT_KB = 233;
const AROMA_EXTRA_LIMIT_KB = 50;   // дополнительный вес колеса ароматов (ТЗ)
const BLOCKING = ['critical', 'serious'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const remote = opt('--url');
const shotsDir = opt('--shots');

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

// ── Локальный сервер для dist/ (с gzip, как GitHub Pages) ───────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain' };
const COMPRESS = new Set(['.html', '.js', '.css', '.svg', '.json', '.xml', '.txt']);

async function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file;
    try { file = join(DIST, decodeURIComponent(url.pathname.slice(BASE.length))); } catch { res.writeHead(400).end(); return; }
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      let body = await readFile(file);
      const headers = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' };
      if (COMPRESS.has(extname(file)) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
        body = gzipSync(body, { level: 9 });
        headers['content-encoding'] = 'gzip';
      }
      res.writeHead(200, headers).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, origin: `http://127.0.0.1:${server.address().port}${BASE}` };
}


// ── Проверки ─────────────────────────────────────────────────────────────
async function runAxe(page, label) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(' ') }));
  }, AXE_TAGS);
  const blocking = result.filter((v) => BLOCKING.includes(v.impact));
  const other = result.filter((v) => !BLOCKING.includes(v.impact));
  if (blocking.length) fail(`${label}: axe — ${blocking.map((v) => `${v.impact}:${v.id}×${v.nodes} (${v.target})`).join('; ')}`);
  else pass(`${label}: axe — 0 critical/serious${other.length ? ` (прочие: ${other.map((v) => `${v.impact}:${v.id}`).join(', ')})` : ''}`);
}

async function checkPage(browser, origin, path, width) {
  const label = `/${path} @${width}px`;
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: shotsDir ? 2 : 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`JS: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(origin)) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(origin + path, { waitUntil: 'networkidle' });

  if (errors.length) fail(`${label}: ${errors.join(' | ')}`); else pass(`${label}: нет ошибок JS и битых запросов`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) fail(`${label}: страница шире экрана на ${overflow}px`); else pass(`${label}: нет прокрутки вбок`);
  const meta = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name=description]')?.content,
    og: document.querySelectorAll('meta[property^="og:"]').length,
  }));
  if (!meta.title || !meta.description || meta.og < 4) fail(`${label}: нет title/description/Open Graph`);

  if (shotsDir) await page.screenshot({ path: join(shotsDir, `${path.replace(/\//g, '') || 'home'}-${width}.png`), fullPage: true });
  await runAxe(page, label);
  if (path === 'baza/') await checkBaza(page, label, width);
  if (path === 'aromaty/') await checkAromaty(page, label);
  await context.close();
}

async function checkBaza(page, label, width) {
  const rows = await page.locator('#samples-body tr').count();
  if (rows < 1) { fail(`${label}: таблица пустая`); return; }
  pass(`${label}: строк в таблице — ${rows}`);

  if (width > 640) {
    // сортировка с клавиатуры: Tab до кнопки заголовка «Год», Enter
    const yearButton = page.locator('th[data-sort="harvestYear"] .sort-button');
    await yearButton.focus();
    await page.keyboard.press('Enter');
    const sortAttr = await page.locator('th[data-sort="harvestYear"]').getAttribute('aria-sort');
    if (sortAttr !== 'ascending') fail(`${label}: Enter на заголовке не включил сортировку (aria-sort=${sortAttr})`);
    else pass(`${label}: сортировка с клавиатуры, aria-sort=ascending`);
    if (!/sort=harvestYear/.test(page.url())) fail(`${label}: сортировка не попала в адрес`); else pass(`${label}: сортировка в адресе страницы`);
  }

  // карточка образца: открыть с клавиатуры, проверить фокус, Esc, возврат фокуса
  const first = page.locator('#samples-body .row-open').first();
  await first.focus();
  await page.keyboard.press('Enter');
  const open = await page.evaluate(() => document.querySelector('#sample-dialog').open);
  const focusInside = await page.evaluate(() => document.querySelector('#sample-dialog').contains(document.activeElement));
  if (!open || !focusInside) fail(`${label}: карточка не открылась или фокус не внутри`); else pass(`${label}: карточка — <dialog>, фокус внутри`);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, `baza-dialog-${width}.png`) });
  await runAxe(page, `${label} [карточка открыта]`);
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => !document.querySelector('#sample-dialog').open);
  const back = await page.evaluate(() => document.activeElement?.classList.contains('row-open'));
  if (!closed || !back) fail(`${label}: Esc не закрыл карточку или фокус не вернулся`); else pass(`${label}: Esc закрывает, фокус возвращается`);
}

async function checkAromaty(page, label) {
  // выбор сорта → полоса сорта на колесе
  await page.locator('#picker-list input[value="Сира"]').check();
  const bands = await page.locator('.bands .band').count();
  if (bands !== 1) fail(`${label}: после выбора сорта нет полосы на колесе`); else pass(`${label}: выбор сорта рисует полосу`);
  // клавиатура: фокус на колесе, стрелка — соседний тон, Enter — подробности
  await page.locator('.tone[tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  const focused = await page.evaluate(() => document.activeElement?.dataset?.id);
  await page.keyboard.press('Enter');
  const shown = await page.locator('#details-body .details__title').textContent().catch(() => '');
  if (!focused || !shown) fail(`${label}: стрелка/Enter на колесе не работают`); else pass(`${label}: колесо с клавиатуры — «${shown}»`);
  // сорт без данных — сообщение в текстовой версии
  await page.locator('#picker-list input[value="Красень"]').check();
  const msg = await page.locator('#profile').textContent();
  if (!msg.includes('Описание аромата для сорта ещё не внесено')) fail(`${label}: нет сообщения для сорта без данных`);
  else pass(`${label}: сорт без данных — сообщение «ещё не внесено»`);
  await runAxe(page, `${label} [сорта выбраны, тон открыт]`);
}

async function measureWeight(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  let bytes = 0;
  let requests = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; requests += 1; });
  await page.goto(`${origin}baza/`, { waitUntil: 'networkidle' });
  await context.close();
  const kb = bytes / 1024;
  const msg = `/baza/: ${kb.toFixed(1)} КБ за ${requests} запросов (лимит ${WEIGHT_LIMIT_KB} КБ)`;
  if (kb > WEIGHT_LIMIT_KB) fail(msg); else pass(msg);
}

/** Все загруженные страницей ресурсы: адрес → переданные байты (кэш выключен). */
async function loadedResources(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const urls = new Map();
  const sizes = new Map();
  cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url));
  cdp.on('Network.loadingFinished', (e) => { if (urls.has(e.requestId)) sizes.set(urls.get(e.requestId), e.encodedDataLength); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await context.close();
  return sizes;
}

// Дополнительный вес колеса = всё, что /aromaty/ загружает сверх общего с главной (шрифты и т. п.):
// своя HTML-страница, JS, CSS и данные колеса — в каком бы общем куске сборки (chunk) они ни оказались.
async function measureAromaExtra(browser, origin) {
  const common = await loadedResources(browser, origin);
  const own = [...(await loadedResources(browser, `${origin}aromaty/`))].filter(([u]) => !common.has(u));
  const kb = own.reduce((sum, [, b]) => sum + b, 0) / 1024;
  const msg = `/aromaty/: сверх общего с главной ${kb.toFixed(1)} КБ за ${own.length} запросов — страница, JS, CSS, данные колеса (лимит ${AROMA_EXTRA_LIMIT_KB} КБ)`;
  if (kb > AROMA_EXTRA_LIMIT_KB) fail(msg); else pass(msg);
}

// ── Запуск ───────────────────────────────────────────────────────────────
const local = remote ? null : await startServer();
const origin = remote ? (remote.endsWith('/') ? remote : `${remote}/`) : local.origin;
// страницы — из того же реестра, что и сборка (src/site/site.js)
const pages = PAGES.map((p) => p.path);
if (shotsDir) await mkdir(shotsDir, { recursive: true });

console.log(`Проверка: ${origin} — страницы: ${pages.map((p) => `/${p}`).join(', ')}`);
const browser = await chromium.launch();
try {
  for (const path of pages) for (const width of WIDTHS) await checkPage(browser, origin, path, width);
  await measureWeight(browser, origin);
  await measureAromaExtra(browser, origin);
} finally {
  await browser.close();
  local?.server.close();
}

console.log(failures.length ? `\nНЕ ПРОЙДЕНО: ${failures.length}` : '\nВСЁ ПРОЙДЕНО');
process.exit(failures.length ? 1 : 0);
