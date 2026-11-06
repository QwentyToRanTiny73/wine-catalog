// Реестр страниц и константы сайта — единственный источник.
// Отсюда берут: vite.config.js (входы сборки, sitemap.xml), partials.js (меню, <head>),
// scripts/audit.mjs (какие страницы проверять). Новая страница — одна строка в PAGES.

export const BASE = '/wine-catalog/';
export const SITE_URL = 'https://qwentytorantiny73.github.io/wine-catalog/';

export const SITE = {
  name: 'Аналитическая база виноматериалов Крыма',
  lab: 'Лаборатория биохимии и химии вина',
  instituteShort: 'ВНИИВиВ «Магарач»',
  instituteFull: 'Всероссийский национальный научно-исследовательский институт виноградарства и виноделия «Магарач»',
  address: '298600, Республика Крым, г. Ялта, ул. Кирова, 31',
  instituteUrl: 'https://magarach-institut.ru/',
};

/** key — имя страницы, file — HTML-исходник, path — адрес от BASE, label — пункт меню;
 *  hidden — служебная: нет в меню и sitemap, закрыта от поисковиков. */
export const PAGES = [
  { key: 'home', file: 'index.html', path: '', label: 'О базе' },
  { key: 'baza', file: 'baza/index.html', path: 'baza/', label: 'База образцов' },
  { key: 'arkhiv', file: 'arkhiv/index.html', path: 'arkhiv/', label: 'Архив' },
  { key: 'aromaty', file: 'aromaty/index.html', path: 'aromaty/', label: 'Ароматы' },
  { key: 'admin', file: 'admin/index.html', path: 'admin/', label: 'Админка', hidden: true },
];

export function page(key) {
  const p = PAGES.find((x) => x.key === key);
  if (!p) throw new Error(`Нет страницы «${key}» в PAGES (src/site/site.js)`);
  return p;
}

/** Адрес страницы на сайте: pageUrl('baza') → '/wine-catalog/baza/'. */
export const pageUrl = (key) => BASE + page(key).path;

/** Страницы для меню и sitemap (без служебных). */
export const PUBLIC_PAGES = PAGES.filter((p) => !p.hidden);
