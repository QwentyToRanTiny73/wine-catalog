import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { renderHead, renderHeader, renderFooter } from './src/site/partials.js';
import { computeStats } from './src/site/stats.js';
import { icon } from './src/site/icons.js';
import { escapeHtml } from './src/lib/format.js';

const BASE = '/wine-catalog/';
const SITE_URL = 'https://qwentytorantiny73.github.io/wine-catalog/';
const DATA_FILE = resolve(import.meta.dirname, 'src/data/samples.json');

// Страницы сайта: ключ — путь в адресе, значение — HTML-файл.
const PAGES = {
  home: 'index.html',
  baza: 'baza/index.html',
};

/**
 * Общие шапка, подвал и <head> — один модуль (src/site/partials.js),
 * вставляется в HTML при сборке. Страница работает и без JavaScript.
 * Метки в HTML:
 *   <!--@head page="baza" title="…" description="…"-->
 *   <!--@header page="baza"-->   <!--@footer-->   <!--@icon flask-->
 *   {{stats.samples}} и т. п. — цифры из src/data/samples.json
 */
function sitePartials() {
  const readData = () => JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  return {
    name: 'site-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const data = readData();
        const stats = computeStats(data);
        const ctx = { base: BASE, siteUrl: SITE_URL, stats, data };
        return html
          .replace(/<!--@head\s+([^>]*?)-->/g, (_, attrs) => renderHead({ ...ctx, ...parseAttrs(attrs) }))
          .replace(/<!--@header\s+page="([^"]+)"\s*-->/g, (_, page) => renderHeader({ ...ctx, page }))
          .replace(/<!--@footer\s*-->/g, () => renderFooter(ctx))
          .replace(/<!--@icon\s+([a-zA-Z]+)\s*-->/g, (_, name) => icon(name))
          .replace(/\{\{\s*stats\.([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) => {
            if (!(key in stats)) throw new Error(`Нет показателя stats.${key} (src/site/stats.js)`);
            return escapeHtml(String(stats[key]));
          });
      },
    },
    handleHotUpdate({ file, server }) {
      if (file === DATA_FILE || file.includes('/src/site/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

function parseAttrs(text) {
  const out = {};
  for (const [, k, v] of text.matchAll(/([a-z]+)="([^"]*)"/g)) out[k] = v;
  return out;
}

export default defineConfig({
  base: BASE,
  plugins: [sitePartials()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(PAGES).map(([k, f]) => [k, resolve(import.meta.dirname, f)])),
    },
  },
});
