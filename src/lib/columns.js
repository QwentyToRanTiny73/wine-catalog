// Колонки таблицы /baza/ — единственный список. Из него берут:
// query.js (по каким колонкам можно сортировать) и pages/baza.js (как рисовать).
// num — число (моноширинные цифры, по правому краю); unit — показать единицу из данных.

export const COLUMNS = [
  { key: 'id', label: '№', rowHeader: true },
  { key: 'variety', label: 'Сорт' },
  { key: 'harvestYear', label: 'Год', num: true },
  { key: 'color', label: 'Цвет' },
  { key: 'wineDistrict', label: 'Район (АВВР)' },
  { key: 'productType', label: 'Тип' },
  { key: 'alcohol', label: 'Спирт', num: true, unit: true },
  { key: 'sugar', label: 'Сахара', num: true, unit: true },
  { key: 'titratedAcidity', label: 'Кислотность', num: true, unit: true },
  { key: 'ph', label: 'pH', num: true },
];

export const isColumn = (key) => COLUMNS.some((c) => c.key === key);
