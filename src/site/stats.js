// Цифры и списки для страниц — считаются из src/data/samples.json при каждой сборке.
// Ничего не вписано руками: обновились данные — обновились цифры.
import { plural } from '../lib/format.js';
import { BLOCKS, WINE_COLORS, SAMPLE_WORDS } from '../lib/domain.js';

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const listOf = (fields) => fields.map((f, i) => (i ? lowerFirst(f.label) : f.label)).join(', ');

export function computeStats(data) {
  const samples = data.samples;
  const years = samples.map((s) => s.harvestYear).filter(Number.isInteger);
  const varieties = new Set(samples.flatMap((s) => s.varieties));
  const districts = new Set(samples.map((s) => s.wineDistrict).filter(Boolean));
  const analytic = data.fields.filter((f) => f.type === 'number');
  const gost = analytic.filter((f) => f.section.includes('ГОСТ'));
  const extra = analytic.length - gost.length;
  const count = (key, value) => samples.filter((s) => s[key] === value).length;

  // Сортовой состав в fields не входит (на сайте он показан как список сортов) — добавляем в подпись блока.
  const tech = data.fields.filter((f) => f.block === BLOCKS.tech);
  const techLabels = tech.map((f) => f.label);
  const nameAt = techLabels.indexOf('Наименование образца');
  techLabels.splice(nameAt >= 0 ? nameAt + 1 : techLabels.length, 0, 'Сортовой состав');

  return {
    samples: samples.length,
    samplesWord: plural(samples.length, SAMPLE_WORDS),
    varieties: varieties.size,
    varietiesWord: plural(varieties.size, ['сорт', 'сорта', 'сортов']),
    districts: districts.size,
    districtsWord: plural(districts.size, ['район', 'района', 'районов']),
    indicators: analytic.length,
    indicatorsWord: plural(analytic.length, ['показатель', 'показателя', 'показателей']),
    gostIndicators: gost.length,
    extraIndicators: extra,
    extraWord: plural(extra, ['дополнительный показатель', 'дополнительных показателя', 'дополнительных показателей']),
    yearFrom: Math.min(...years),
    yearTo: Math.max(...years),
    years: new Set(years).size,
    byYear: [...new Set(years)].sort((a, b) => a - b).map((year) => ({ year, count: years.filter((y) => y === year).length })),
    ...Object.fromEntries(WINE_COLORS.map((c) => [c.key, count('color', c.value)])),   // white, red, rose
    wineMaterial: count('productType', 'виноматериал'),
    wine: count('productType', 'вино'),
    blends: samples.filter((s) => s.blend).length,
    gostList: listOf(gost),
    orgList: listOf(data.fields.filter((f) => f.block === BLOCKS.org)),
    techList: techLabels.map((l, i) => (i ? lowerFirst(l) : l)).join(', '),
  };
}
