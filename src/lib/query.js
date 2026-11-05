// Фильтрация, сортировка и состояние в адресе страницы для /baza/.
// Только чистые функции: не трогают DOM, проверяются тестами (test/query.test.js).
import { varietyLabel, sampleNumber, isEmpty, countBy } from './format.js';
import { isColumn } from './columns.js';

/** Фильтры-списки: параметр в адресе → значения образца; capitalize — как подписать в списке. */
export const SELECT_FILTERS = {
  variety: { values: (s) => s.varieties },               // купаж попадает в каждый свой сорт
  year: { values: (s) => (s.harvestYear == null ? [] : [String(s.harvestYear)]) },
  color: { values: (s) => (s.color ? [s.color] : []), capitalize: true },
  type: { values: (s) => (s.productType ? [s.productType] : []), capitalize: true },
  district: { values: (s) => (s.wineDistrict ? [s.wineDistrict] : []) },
};

/** Значение для сортировки: по умолчанию поле образца; особые — только «№» и «Сорт». */
const SORT_VALUE = {
  id: (s) => s.labNumber,   // лабораторный номер; «б/н» — пустое значение, уходит в конец
  variety: (s) => (s.varieties.length ? varietyLabel(s) : null),
};
const sortValue = (key) => SORT_VALUE[key] ?? ((s) => s[key]);

export const DEFAULT_STATE = Object.freeze({
  q: '', variety: '', year: '', color: '', type: '', district: '', sort: 'id', dir: 'asc', id: null,
});

const SEARCH_FIELDS = ['name', 'wineDistrict', 'climateZone', 'adminRegion', 'location', 'grapeProducer',
  'winery', 'color', 'productType', 'varietyRaw'];

const normalizeText = (text) => String(text ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// данные не меняются — нормализованная строка поиска считается один раз на образец
const searchCache = new WeakMap();
function searchText(s) {
  if (!searchCache.has(s)) {
    const parts = [sampleNumber(s), s.harvestYear, ...s.varieties, ...SEARCH_FIELDS.map((k) => s[k])];
    searchCache.set(s, normalizeText(parts.filter((p) => p != null).join(' ')));
  }
  return searchCache.get(s);
}

/** Образцы, подходящие под все фильтры. Поиск: все слова запроса должны встретиться. */
export function filterSamples(samples, state) {
  const words = normalizeText(state.q).split(' ').filter(Boolean);
  const active = Object.entries(SELECT_FILTERS).filter(([key]) => state[key]);
  return samples.filter((s) =>
    active.every(([key, f]) => f.values(s).includes(state[key])) &&
    words.every((w) => searchText(s).includes(w)));
}

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** Сортировка. Пустые значения всегда в конце — при любом направлении. При равенстве — по ключу образца. */
export function sortSamples(samples, sortKey, dir) {
  const get = sortValue(isColumn(sortKey) ? sortKey : 'id');
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
    const counts = countBy(samples.flatMap((s) => [...new Set(filter.values(s))]));
    const values = [...counts.keys()].sort(key === 'year' ? (a, b) => Number(b) - Number(a) : collator.compare);
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
  if (isColumn(p.get('sort'))) state.sort = p.get('sort');
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
    if (!isEmpty(v) && v !== def) p.set(key, String(v));
  }
  const text = p.toString();
  return text ? `?${text}` : '';
}
