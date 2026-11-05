// Проверка логики /baza/: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSamples, sortSamples, filterOptions, readState, writeState, DEFAULT_STATE } from '../src/lib/query.js';
import { formatNumber, plural, varietyLabel, sampleTitle } from '../src/lib/format.js';

const S = [
  { id: 1, labNumber: 1, varieties: ['Мерло'], blend: false, harvestYear: 2019, color: 'красное', ph: 3.5, alcohol: 13 },
  { id: 2, labNumber: 2, varieties: ['Каберне-Совиньон', 'Мерло'], blend: true, harvestYear: 2020, color: 'красное', ph: null, alcohol: 12.5 },
  { id: 3, labNumber: 3, varieties: ['Шардоне'], blend: false, harvestYear: 2019, color: 'белое', ph: 3.2, name: 'Ёлочка' },
  { id: 4, labNumber: 4, varieties: [], blend: true, harvestYear: 2021, color: 'красное', ph: 3.9 },   // купаж, состав неизвестен
  { id: 5, labNumber: 5, varieties: [], blend: false, harvestYear: 2022, color: 'белое', ph: 3.2 },   // сорт не указан
];
const ids = (list) => list.map((s) => s.id);
const st = (over) => ({ ...DEFAULT_STATE, ...over });

test('фильтр по сорту находит и купажи с этим сортом', () => {
  assert.deepEqual(ids(filterSamples(S, st({ variety: 'Мерло' }))), [1, 2]);
});

test('фильтры складываются (И)', () => {
  assert.deepEqual(ids(filterSamples(S, st({ variety: 'Мерло', year: '2020' }))), [2]);
  assert.deepEqual(ids(filterSamples(S, st({ color: 'белое', year: '2019' }))), [3]);
});

test('поиск: без учёта регистра и ё/е, все слова должны встретиться', () => {
  assert.deepEqual(ids(filterSamples(S, st({ q: 'елочка' }))), [3]);
  assert.deepEqual(ids(filterSamples(S, st({ q: 'КАБЕРНЕ мерло' }))), [2]);
  assert.deepEqual(ids(filterSamples(S, st({ q: 'шардоне мерло' }))), []);
});

test('пустые значения в конце при сортировке по возрастанию', () => {
  assert.deepEqual(ids(sortSamples(S, 'ph', 'asc')), [3, 5, 1, 4, 2]);
});

test('пустые значения в конце и при сортировке по убыванию', () => {
  assert.deepEqual(ids(sortSamples(S, 'ph', 'desc')), [4, 1, 3, 5, 2]);
  assert.deepEqual(ids(sortSamples(S, 'alcohol', 'desc')).slice(-3), [3, 4, 5]);
});

test('образцы без сорта — в конце сортировки по сорту', () => {
  assert.deepEqual(ids(sortSamples(S, 'variety', 'asc')), [2, 1, 3, 4, 5]);
});

test('неизвестная колонка сортировки — сортировка по номеру', () => {
  assert.deepEqual(ids(sortSamples([S[2], S[0]], 'constructor', 'asc')), [1, 3]);
});

test('счётчики в списках: купаж учитывается в каждом своём сорте', () => {
  const o = filterOptions(S);
  assert.deepEqual(o.variety, [
    { value: 'Каберне-Совиньон', count: 1 }, { value: 'Мерло', count: 2 }, { value: 'Шардоне', count: 1 },
  ]);
  assert.deepEqual(o.year.map((y) => y.value), ['2022', '2021', '2020', '2019']);
});

test('состояние в адресе: туда и обратно', () => {
  const state = st({ q: 'мерло', year: '2019', sort: 'ph', dir: 'desc', id: 121 });
  const url = writeState(state);
  assert.deepEqual(readState(url), state);
  assert.equal(writeState(DEFAULT_STATE), '');
});

test('мусор в адресе отбрасывается', () => {
  const s = readState('?sort=constructor&dir=up&id=-5&year=2019');
  assert.equal(s.sort, 'id');
  assert.equal(s.dir, 'asc');
  assert.equal(s.id, null);
  assert.equal(s.year, '2019');
});

test('числа — как в данных, с запятой; склонения', () => {
  assert.equal(formatNumber(4.008), '4,008');
  assert.equal(formatNumber(13), '13');
  assert.equal(formatNumber(null), '');
  assert.equal(plural(190, ['образец', 'образца', 'образцов']), 'образцов');
  assert.equal(plural(23, ['показатель', 'показателя', 'показателей']), 'показателя');
  assert.equal(plural(11, ['сорт', 'сорта', 'сортов']), 'сортов');
});

test('подпись состава', () => {
  assert.equal(varietyLabel(S[1]), 'Каберне-Совиньон + Мерло');
  assert.equal(varietyLabel(S[3]), 'Купаж, состав неизвестен');
  assert.equal(varietyLabel(S[4]), 'Сорт не указан');
});

// Р22: образец без лабораторного номера — «б/н», внутренний ключ не показывается
const NONUM = { id: 100030, labNumber: null, varieties: ['Алиготе'], blend: false, harvestYear: 2018, color: 'белое' };

test('сортировка по номеру: образцы «б/н» в конце в обе стороны', () => {
  assert.deepEqual(ids(sortSamples([NONUM, S[1], S[0]], 'id', 'asc')), [1, 2, 100030]);
  assert.deepEqual(ids(sortSamples([NONUM, S[1], S[0]], 'id', 'desc')), [2, 1, 100030]);
});

test('поиск «б/н» находит образцы без номера; поиск по номеру — по лабораторному', () => {
  assert.deepEqual(ids(filterSamples([NONUM, ...S], st({ q: 'б/н' }))), [100030]);
  assert.deepEqual(ids(filterSamples([NONUM, ...S], st({ q: '100030' }))), []);
});

test('заголовок карточки', () => {
  assert.equal(sampleTitle(S[0]), 'Образец № 1');
  assert.equal(sampleTitle(NONUM), 'Образец без номера');
});
