// CSV из админки должен совпадать байт в байт с тем, что пишет Python: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, serializeCsv } from '../src/lib/csv.js';

for (const file of ['aroma-descriptors.csv', 'sample-notes.csv', 'variety-map.csv']) {
  test(`чтение и запись без изменений: data/${file}`, () => {
    const text = readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf-8');
    const { header, rows } = parseCsv(text);
    assert.equal(serializeCsv(header, rows), text);
  });
}

test('кавычка в середине поля — обычный символ, пустые строки пропускаются (как Python csv)', () => {
  const { rows } = parseCsv('\uFEFFa;b\r\n1;текст 5" бутылка\r\n\r\n2;x\r\n\r\n');
  assert.deepEqual(rows, [{ a: '1', b: 'текст 5" бутылка' }, { a: '2', b: 'x' }]);
  assert.deepEqual(parseCsv('a;b\r1;2\r3;4\r').rows, [{ a: '1', b: '2' }, { a: '3', b: '4' }]);   // концы строк только \r
});

test('кавычки, «;» и перевод строки внутри поля', () => {
  const rows = [{ a: 'x;y', b: 'он сказал "да"', c: 'две\nстроки' }];
  const text = serializeCsv(['a', 'b', 'c'], rows);
  assert.deepEqual(parseCsv(text).rows, rows);
});
