// Фильтрация, сортировка и состояние в адресе страницы для /baza/.
// Только чистые функции: не трогают DOM, проверяются тестами (test/query.test.js).
import { varietyLabel } from './format.js';

/** Фильтры-списки: параметр в адресе → как достать значение из образца. */
export const SELECT_FILTERS = {
  variety: { values: (s) => s.varieties },               // купаж попадает в каждый свой сорт
  year: { values: (s) => (s.harvestYear == null ? [] : [String(s.harvestYear)]) },
  color: { values: (s) => (s.color ? [s.color] : []) },
  type: { values: (s) => (s.productType ? [s.productType] : []) },
  district: { values: (s) => (s.wineDistrict ? [s.wineDistrict] : []) },
};

/** Колонки, по которым можно сортировать: ключ → значение для сравнения. */
export const SORT_KEYS = {
  id: (s) => s.id,
  variety: (s) => (s.varieties.length ? varietyLabel(s) : null),
  harvestYear: (s) => s.harvestYear,
  color: (s) => s.color,
  wineDistrict: (s) => s.wineDistrict,
  productType: (s) => s.productType,
  alcohol: (s) => s.alcohol,
  sugar: (s) => s.sugar,
  titratedAcidity: (s) => s.titratedAcidity,
  ph: (s) => s.ph,
};

export const DEFAULT_STATE = Object.freeze({
  q: '', variety: '', year: '', color: '', type: '', district: '', sort: 'id', dir: 'asc', id: null,
});

const SEARCH_FIELDS = ['name', 'wineDistrict', 'climateZone', 'adminRegion', 'location', 'grapeProducer',
  'winery', 'color', 'productType', 'varietyRaw'];

export function normalizeText(text) {
  return String(text ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function searchText(s) {
  const parts = [s.id, s.harvestYear, ...s.varieties, ...SEARCH_FIELDS.map((k) => s[k])];
  return normalizeText(parts.filter((p) => p != null).join(' '));
}

/** Образцы, подходящие под все фильтры. Поиск: все слова запроса должны встретиться. */
export function filterSamples(samples, state) {
  const words = normalizeText(state.q).split(' ').filter(Boolean);
  return samples.filter((s) => {
    for (const [key, filter] of Object.entries(SELECT_FILTERS)) {
      if (state[key] && !filter.values(s).includes(state[key])) return false;
    }
    if (words.length) {
      const hay = searchText(s);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
const isEmpty = (v) => v === null || v === undefined || v === '';

/** Сортировка. Пустые значения всегда в конце — при любом направлении. При равенстве — по номеру. */
export function sortSamples(samples, sortKey, dir) {
  const get = Object.hasOwn(SORT_KEYS, sortKey) ? SORT_KEYS[sortKey] : SORT_KEYS.id;
  const sign = dir === 'desc' ? -1 : 1;
  return [...samples].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const ea = isEmpty(va);
    const eb = isEmpty(vb);
    if (ea !== eb) return ea ? 1 : -1;
    let cmp = 0;
    if (!ea) cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
    return cmp !== 0 ? sign * cmp : a.id - b.id;
  });
}

/** Варианты для списков фильтров со счётчиками (купаж считается в каждом своём сорте). */
export function filterOptions(samples) {
  const out = {};
  for (const [key, filter] of Object.entries(SELECT_FILTERS)) {
    const counts = new Map();
    for (const s of samples) for (const v of new Set(filter.values(s))) counts.set(v, (counts.get(v) ?? 0) + 1);
    const values = [...counts.keys()];
    values.sort(key === 'year' ? (a, b) => Number(b) - Number(a) : collator.compare);
    out[key] = values.map((value) => ({ value, count: counts.get(value) }));
  }
  return out;
}

/** Состояние из адреса страницы. Неизвестные и некорректные значения отбрасываются. */
export function readState(search) {
  const p = new URLSearchParams(search);
  const state = { ...DEFAULT_STATE };
  state.q = (p.get('q') ?? '').slice(0, 200);
  for (const key of Object.keys(SELECT_FILTERS)) state[key] = p.get(key) ?? '';
  if (Object.hasOwn(SORT_KEYS, p.get('sort') ?? '')) state.sort = p.get('sort');
  if (p.get('dir') === 'desc') state.dir = 'desc';
  const id = Number.parseInt(p.get('id') ?? '', 10);
  state.id = Number.isInteger(id) && id > 0 ? id : null;
  return state;
}

/** Строка адреса для состояния: только то, что отличается от значений по умолчанию. */
export function writeState(state) {
  const p = new URLSearchParams();
  for (const [key, def] of Object.entries(DEFAULT_STATE)) {
    const v = state[key];
    if (v !== null && v !== undefined && v !== '' && v !== def) p.set(key, String(v));
  }
  const text = p.toString();
  return text ? `?${text}` : '';
}
