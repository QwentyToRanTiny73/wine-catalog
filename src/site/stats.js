// Цифры для страниц — считаются из src/data/samples.json при каждой сборке.
// Ничего не вписано руками: обновились данные — обновились цифры.
import { plural, countBy } from '../lib/format.js';
import { GOST_SECTION, PRODUCT_TYPES, SAMPLE_WORDS } from '../lib/domain.js';

export function computeStats(data) {
  const samples = data.samples;
  const byYear = [...countBy(samples.map((s) => s.harvestYear).filter(Number.isInteger))]
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => ({ year, count }));
  const varieties = new Set(samples.flatMap((s) => s.varieties)).size;
  const analytic = data.fields.filter((f) => f.type === 'number');
  const gost = analytic.filter((f) => f.section === GOST_SECTION).length;
  if (!gost) throw new Error(`В данных нет раздела «${GOST_SECTION}» — изменился заголовок в Excel?`);
  const productCount = (type) => samples.filter((s) => s.productType === type).length;

  return {
    samples: samples.length,
    samplesWord: plural(samples.length, SAMPLE_WORDS),
    varieties,
    varietiesWord: plural(varieties, ['сорт', 'сорта', 'сортов']),
    districts: new Set(samples.map((s) => s.wineDistrict).filter(Boolean)).size,
    indicators: analytic.length,
    indicatorsWord: plural(analytic.length, ['показатель', 'показателя', 'показателей']),
    gostIndicators: gost,
    byYear,
    years: byYear.length,
    yearsWord: plural(byYear.length, ['урожай', 'урожая', 'урожаев']),
    yearFrom: byYear[0].year,
    yearTo: byYear.at(-1).year,
    wineMaterial: productCount(PRODUCT_TYPES.wineMaterial),
    wine: productCount(PRODUCT_TYPES.wine),
    blends: samples.filter((s) => s.blend).length,
  };
}
