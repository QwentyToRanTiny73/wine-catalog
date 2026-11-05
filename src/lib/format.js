// Общие помощники: работают и в браузере, и при сборке (vite.config.js).

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Экранирование для вставки текста в HTML при сборке. В браузере данные выводятся через textContent. */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Число в русской записи без переокругления: знаков столько, сколько в данных
 * (решение Р20: значения — как введены в Excel). 13.5 → «13,5», 2490 → «2490».
 */
export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value).replace('.', ',').replace('-', '−');
}

/** «Каберне-Совиньон + Мерло»; пустой состав — понятная подпись. */
export function varietyLabel(sample) {
  if (sample.varieties && sample.varieties.length) return sample.varieties.join(' + ');
  return sample.blend ? 'Купаж, состав неизвестен' : 'Сорт не указан';
}

/** Склонение: plural(5, ['образец', 'образца', 'образцов']) → «образцов». */
export function plural(n, [one, few, many]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}
