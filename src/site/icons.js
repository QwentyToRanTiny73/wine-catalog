// Собственные иконки (решение Р9): сетка 24×24, линия 1.5, один цвет (currentColor),
// без заливок. Логотипы института и журнала здесь не воспроизводятся.
// Строки — постоянные, не данные: их можно вставлять в HTML как есть.

const PATHS = {
  glass: '<path d="M8 3.5h8l.5 5a4.5 4.5 0 0 1-9 0z"/><path d="M12 13v6.5M8.5 20.5h7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 14v5.5H4.5V7H10"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sort: '<path d="M8 9.5 12 5.5l4 4M8 14.5l4 4 4-4"/>',
  sortAsc: '<path d="M12 19V5.5M7 10.5l5-5 5 5"/>',
  sortDesc: '<path d="M12 5v13.5M7 13.5l5 5 5-5"/>',
  flask: '<path d="M9.5 3.5h5M10.5 3.5v5.2l-4.9 8.9A1.6 1.6 0 0 0 7 20h10a1.6 1.6 0 0 0 1.4-2.4l-4.9-8.9V3.5"/><path d="M8 14.5h8"/>',
  pin: '<path d="M12 20.5s-6-5.6-6-10.5a6 6 0 0 1 12 0c0 4.9-6 10.5-6 10.5z"/><circle cx="12" cy="10" r="2.2"/>',
  table: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 9.5h16M4 14h16M10 9.5V19"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5 8.5v11h14v-11M10 12.5h4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
  reset: '<path d="M5.5 12a6.5 6.5 0 1 0 2-4.7"/><path d="M5 4.5V8h3.5"/>',
  document: '<path d="M6.5 3.5H14l4 4v13H6.5z"/><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5"/>',
  scales: '<path d="M12 4v16M8 20h8M5 7h14"/><path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
};

/** SVG-иконка. Декоративная (aria-hidden): смысл передаёт текст рядом. */
export function icon(name, className = 'icon') {
  const body = PATHS[name];
  if (!body) throw new Error(`Нет иконки «${name}»`);
  return `<svg class="${className}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

