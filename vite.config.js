import { resolve } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { defineConfig } from 'vite';
import { renderHead, renderHeader, renderFooter, renderSitemap, externalLink } from './src/site/partials.js';
import { computeStats } from './src/site/stats.js';
import { icon } from './src/site/icons.js';
import { renderYearColumns, renderColorSplit, renderChromatogram } from './src/site/charts.js';
import { renderArchive } from './src/site/archive.js';
import { BASE, SITE, PAGES, pageUrl } from './src/site/site.js';
import { escapeHtml } from './src/lib/format.js';

const ROOT = import.meta.dirname;
const DATA_FILE = resolve(ROOT, 'src/data/samples.json');

/** Данные и цифры читаются один раз и перечитываются, только если файл изменился. */
let cache = { mtime: 0, data: null, stats: null };
function loadData() {
  const mtime = statSync(DATA_FILE).mtimeMs;
  if (mtime !== cache.mtime) {
    const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    cache = { mtime, data, stats: computeStats(data) };
  }
  return cache;
}

const CHARTS = { years: renderYearColumns, colors: renderColorSplit, chromatogram: renderChromatogram };

/** Метки <!--@имя …-->: одна таблица; неизвестная метка — ошибка сборки, а не тихий комментарий. */
const MARKERS = {
  head: (ctx, { attrs }) => renderHead({ ...ctx, ...attrs }),
  header: (ctx) => renderHeader(ctx),
  footer: (ctx) => renderFooter(ctx),
  icon: (ctx, { arg }) => icon(arg),
  external: (ctx, { attrs }) => externalLink(attrs.href, attrs.text),
  archive: (ctx) => renderArchive(ctx),
  chart: (ctx, { arg }) => {
    if (!CHARTS[arg]) throw new Error(`Нет графика «${arg}» (src/site/charts.js)`);
    return CHARTS[arg](ctx);
  },
};

/** Значения {{база.ключ}}: {{base}}, {{stats.samples}}, {{site.lab}}, {{url.baza}}. */
function templateValue(ctx, scope, key) {
  const scopes = { stats: ctx.stats, site: SITE, url: Object.fromEntries(PAGES.map((p) => [p.key, pageUrl(p.key)])) };
  if (scope === 'base' && !key) return BASE;
  if (scopes[scope] && key in scopes[scope]) return String(scopes[scope][key]);
  throw new Error(`Неизвестное значение {{${scope}${key ? `.${key}` : ''}}}`);
}

function parseMarker(rest) {
  const attrs = {};
  for (const [, k, v] of rest.matchAll(/([a-z]+)="([^"]*)"/g)) attrs[k] = v;
  const arg = rest.replace(/[a-z]+="[^"]*"/g, '').trim() || null;
  return { attrs, arg };
}

/**
 * Общие части, графики и цифры вставляются в HTML при сборке — страницы работают без JavaScript.
 * Порядок: сначала {{…}} в шаблоне страницы, потом метки — текст из Excel не разбирается как шаблон.
 */
function sitePartials() {
  return {
    name: 'site-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, { filename }) {
        const pageDef = PAGES.find((p) => resolve(ROOT, p.file) === filename);
        if (!pageDef) throw new Error(`Файл ${filename} не описан в PAGES (src/site/site.js)`);
        const { data, stats } = loadData();
        const ctx = { page: pageDef.key, base: BASE, stats, data };
        return html
          .replace(/\{\{\s*([a-z]+)(?:\.([a-zA-Z0-9_]+))?\s*\}\}/g, (_, scope, key) => escapeHtml(templateValue(ctx, scope, key)))
          .replace(/<!--@([a-z]+)\b([^>]*?)-->/g, (_, name, rest) => {
            if (!MARKERS[name]) throw new Error(`Неизвестная метка <!--@${name}--> в ${pageDef.file}`);
            return MARKERS[name](ctx, parseMarker(rest));
          });
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap() });
    },
    handleHotUpdate({ file, server }) {
      if (file === DATA_FILE || file.includes('/src/site/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [sitePartials()],
  // данные встраиваются строкой JSON и разбираются JSON.parse — быстрее, чем JS-литерал
  json: { stringify: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(PAGES.map((p) => [p.key, resolve(ROOT, p.file)])),
    },
  },
});
