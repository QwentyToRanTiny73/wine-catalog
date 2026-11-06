// Общие части всех страниц — один модуль (требование «Общие шапка и подвал»).
// Вставляются в HTML при сборке плагином в vite.config.js.
import { icon } from './icons.js';
import { escapeHtml as esc } from '../lib/format.js';
import { BASE, SITE_URL, SITE, PUBLIC_PAGES, page as findPage } from './site.js';

/** <head>: заголовок, описание, Open Graph, канонический адрес, иконка вкладки. */
export function renderHead({ page, title, description }) {
  if (!title || !description) throw new Error(`У страницы «${page}» нет title или description`);
  const def = findPage(page);
  const url = SITE_URL + def.path;
  const fullTitle = page === 'home' ? title : `${title} — ${SITE.name}`;
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(fullTitle)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta name="theme-color" content="#fbfaf7" />
    <meta name="color-scheme" content="light" />${def.hidden ? '\n    <meta name="robots" content="noindex, nofollow" />' : ''}
    <link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:site_name" content="${esc(SITE.name)}" />
    <meta property="og:title" content="${esc(fullTitle)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />`;
}

const navLink = (p, current) =>
  `<li><a href="${BASE}${p.path}"${p.key === current ? ' aria-current="page"' : ''}>${esc(p.label)}</a></li>`;

/** Внешняя ссылка: новая вкладка, иконка и предупреждение для скринридера. */
export function externalLink(href, text) {
  return `<a href="${esc(href)}" rel="noopener" target="_blank">${esc(text)}${icon('external', 'icon icon--inline')}<span class="visually-hidden"> (откроется в новой вкладке)</span></a>`;
}

export function renderHeader({ page }) {
  return `<a class="skip-link" href="#main">Перейти к содержанию</a>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="${BASE}">
      ${icon('glass', 'icon brand__mark')}
      <span class="brand__text">
        <span class="brand__title">${esc(SITE.name)}</span>
        <span class="brand__subtitle">${esc(SITE.lab)} · ${esc(SITE.instituteShort)}</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Разделы сайта">
      <ul>${PUBLIC_PAGES.map((p) => navLink(p, page)).join('')}</ul>
    </nav>
  </div>
</header>`;
}

export function renderFooter({ stats }) {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="container site-footer__inner">
    <div class="site-footer__col">
      <p class="site-footer__title">${esc(SITE.lab)}</p>
      <p>${esc(SITE.instituteFull)}</p>
      <p>${esc(SITE.address)}</p>
    </div>
    <div class="site-footer__col">
      <p class="site-footer__title">Разделы</p>
      <ul class="site-footer__links">
        ${PUBLIC_PAGES.map((p) => navLink(p, null)).join('')}
        <li>${externalLink(SITE.instituteUrl, 'Официальный сайт института')}</li>
      </ul>
    </div>
    <div class="site-footer__col">
      <p class="site-footer__title">Данные</p>
      <p><span class="num">${stats.samples}</span> ${stats.samplesWord}, урожаи <span class="num">${stats.yearFrom}–${stats.yearTo}</span>.</p>
      <p>© ${year} ${esc(SITE.instituteShort)}</p>
    </div>
  </div>
</footer>`;
}

/** sitemap.xml из реестра страниц — генерируется при сборке. */
export function renderSitemap() {
  const urls = PUBLIC_PAGES.map((p) => `  <url><loc>${SITE_URL}${p.path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
