// Общие помощники: работают и в браузере, и при сборке (vite.config.js).

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Экранирование для вставки текста в HTML при сборке. В браузере данные выводятся через textContent. */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Пустое значение: нет данных в исходнике. Единая проверка для всего сайта. */
export const isEmpty = (v) => v === null || v === undefined || v === '';

/**
 * Число в русской записи без переокругления: знаков столько, сколько в данных
 * (решение Р20: значения — как введены в Excel). 13.5 → «13,5», 2490 → «2490».
 */
export function formatNumber(value) {
  if (isEmpty(value)) return '';
  return String(value).replace('.', ',').replace('-', '−');
}

/** «Каберне-Совиньон + Мерло»; пустой состав — понятная подпись. */
export function varietyLabel(sample) {
  if (sample.varieties && sample.varieties.length) return sample.varieties.join(' + ');
  return sample.blend ? 'Купаж, состав неизвестен' : 'Сорт не указан';
}

/** Лабораторный номер для показа: «113» или «б/н» (решение Р22: номер не выдумывается). */
export const sampleNumber = (sample) => (sample.labNumber == null ? 'б/н' : String(sample.labNumber));

/** «Образец № 113» или «Образец без номера». */
export function sampleTitle(sample) {
  return sample.labNumber == null ? 'Образец без номера' : `Образец № ${sample.labNumber}`;
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Сколько раз встречается каждое значение: countBy(['а','б','а']) → Map {а→2, б→1}. */
export function countBy(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/** Склонение: plural(5, ['образец', 'образца', 'образцов']) → «образцов». */
export function plural(n, [one, few, many]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}
