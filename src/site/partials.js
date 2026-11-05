// Общие части всех страниц — один модуль (требование «Общие шапка и подвал»).
// Вставляются в HTML при сборке плагином в vite.config.js.
import { icon } from './icons.js';
import { escapeHtml as esc } from '../lib/format.js';

export const SITE_NAME = 'Аналитическая база виноматериалов Крыма';
const LAB = 'Лаборатория биохимии и химии вина';
const INSTITUTE_SHORT = 'ВНИИВиВ «Магарач»';
const INSTITUTE_FULL =
  'Всероссийский национальный научно-исследовательский институт виноградарства и виноделия «Магарач»';
const ADDRESS = '298600, Республика Крым, г. Ялта, ул. Кирова, 31';
const INSTITUTE_URL = 'https://magarach-institut.ru/';

// Пункты меню: ключ страницы → путь от base и подпись.
const NAV = [
  { page: 'home', path: '', label: 'О базе' },
  { page: 'baza', path: 'baza/', label: 'База образцов' },
  { page: 'arkhiv', path: 'arkhiv/', label: 'Архив' },
];

/** <head>: заголовок, описание, Open Graph, канонический адрес, иконка вкладки. */
export function renderHead({ base, siteUrl, page, title, description }) {
  const item = NAV.find((n) => n.page === page);
  if (!item) throw new Error(`Неизвестная страница «${page}» в <!--@head-->`);
  if (!title || !description) throw new Error(`У страницы «${page}» нет title или description`);
  const url = siteUrl + item.path;
  const fullTitle = page === 'home' ? title : `${title} — ${SITE_NAME}`;
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(fullTitle)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta name="theme-color" content="#fbfaf7" />
    <meta name="color-scheme" content="light" />
    <link rel="icon" href="${base}favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:site_name" content="${esc(SITE_NAME)}" />
    <meta property="og:title" content="${esc(fullTitle)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />`;
}

export function renderHeader({ base, page }) {
  const links = NAV.map((n) => {
    const current = n.page === page ? ' aria-current="page"' : '';
    return `<li><a href="${base}${n.path}"${current}>${esc(n.label)}</a></li>`;
  }).join('');
  return `<a class="skip-link" href="#main">Перейти к содержанию</a>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="${base}">
      ${icon('glass', 'icon brand__mark')}
      <span class="brand__text">
        <span class="brand__title">${esc(SITE_NAME)}</span>
        <span class="brand__subtitle">${esc(LAB)} · ${esc(INSTITUTE_SHORT)}</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Разделы сайта">
      <ul>${links}</ul>
    </nav>
  </div>
</header>`;
}

export function renderFooter({ base, stats }) {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="container site-footer__inner">
    <div class="site-footer__col">
      <p class="site-footer__title">${esc(LAB)}</p>
      <p>${esc(INSTITUTE_FULL)}</p>
      <p>${esc(ADDRESS)}</p>
    </div>
    <div class="site-footer__col">
      <p class="site-footer__title">Разделы</p>
      <ul class="site-footer__links">
        ${NAV.map((n) => `<li><a href="${base}${n.path}">${esc(n.label)}</a></li>`).join('')}
        <li><a href="${INSTITUTE_URL}" rel="noopener" target="_blank">Официальный сайт института${icon('external', 'icon icon--inline')}<span class="visually-hidden"> (откроется в новой вкладке)</span></a></li>
      </ul>
    </div>
    <div class="site-footer__col">
      <p class="site-footer__title">Данные</p>
      <p><span class="num">${stats.samples}</span> образцов, урожаи <span class="num">${stats.yearFrom}–${stats.yearTo}</span>.</p>
      <p>© ${year} ${esc(INSTITUTE_SHORT)}</p>
    </div>
  </div>
</footer>`;
}
