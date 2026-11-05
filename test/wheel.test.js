// Проверка геометрии и состояния колеса ароматов: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout, polar, arcPath, radialLabel, splitLabel, readAromaState, writeAromaState, MAX_COMPARE } from '../src/lib/wheel.js';

const taxonomy = JSON.parse(readFileSync(new URL('../src/data/aroma/taxonomy.json', import.meta.url), 'utf-8'));

test('раскладка: все дескрипторы по кругу, сектора равные и без зазоров', () => {
  const { categories, descriptors, step } = layout(taxonomy);
  assert.equal(descriptors.length, 72);
  assert.equal(step, 5);
  assert.equal(descriptors[0].start, 0);
  assert.equal(descriptors.at(-1).end, 360);
  for (let i = 1; i < descriptors.length; i += 1) assert.equal(descriptors[i].start, descriptors[i - 1].end);
  // группа и категория охватывают ровно свои дескрипторы
  for (const c of categories) {
    assert.equal(c.start, c.groups[0].start);
    assert.equal(c.end, c.groups.at(-1).end);
  }
});

test('точки на окружности: 0° — верх, 90° — справа', () => {
  assert.deepEqual(polar(100, 0, 400), [400, 300]);
  assert.deepEqual(polar(100, 90, 400), [500, 400]);
  assert.deepEqual(polar(100, 180, 400), [400, 500]);
});

test('кольцевой сектор — замкнутый путь из двух дуг', () => {
  const d = arcPath(100, 200, 0, 90);
  assert.match(d, /^M[\d.]+ [\d.]+A200 200 0 0 1 .*L.*A100 100 0 0 0 .*Z$/);
});

test('подписи на левой половине разворачиваются', () => {
  assert.equal(radialLabel(100, 45).rotate, -45);
  assert.equal(radialLabel(100, 225).rotate, 315);
});

test('длинные подписи — в две строки', () => {
  assert.deepEqual(splitLabel('мёд', 10), ['мёд']);
  assert.deepEqual(splitLabel('лист чёрной смородины', 14), ['лист чёрной', 'смородины']);
});

test('состояние в адресе: туда и обратно, мусор отбрасывается, не больше трёх сортов', () => {
  const names = ['Сира', 'Мерло', 'Шардоне', 'Рислинг'];
  const ids = ['chernyj-perec', 'roza'];
  const s = { varieties: ['Сира', 'Мерло'], descriptor: 'roza' };
  assert.deepEqual(readAromaState(writeAromaState(s), names, ids), s);
  const messy = readAromaState('?v=Сира,Неизвестный,Сира,Мерло,Шардоне,Рислинг&d=kosmos', names, ids);
  assert.equal(messy.varieties.length, MAX_COMPARE);
  assert.deepEqual(messy.varieties, ['Сира', 'Мерло', 'Шардоне']);
  assert.equal(messy.descriptor, null);
});
