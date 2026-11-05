// /baza/ — единственная таблица образцов.
// Данные выводятся только через textContent; innerHTML — лишь для постоянных SVG-иконок.
import data from '../data/samples.json';
import { filterSamples, sortSamples, filterOptions, readState, writeState, SELECT_FILTERS, DEFAULT_STATE } from '../lib/query.js';
import { formatNumber, varietyLabel, plural } from '../lib/format.js';
import { icon } from '../site/icons.js';

const SAMPLES = data.samples;
const BY_ID = new Map(SAMPLES.map((s) => [s.id, s]));
const FIELDS = new Map(data.fields.map((f) => [f.key, f]));
const unitOf = (key) => FIELDS.get(key)?.unit ?? '';

const ORG_BLOCK = 'Организационный блок';
const TECH_BLOCK = 'Технический блок';
const ANALYTIC_BLOCK = 'Аналитический блок';

// Колонки таблицы. В карточке образца — все поля из данных.
const COLUMNS = [
  { key: 'id', label: '№', rowHeader: true, cell: idCell },
  { key: 'variety', label: 'Сорт', cell: varietyCell },
  { key: 'harvestYear', label: 'Год', num: true },
  { key: 'color', label: 'Цвет', cell: colorCell },
  { key: 'wineDistrict', label: 'Район (АВВР)' },
  { key: 'productType', label: 'Тип' },
  { key: 'alcohol', label: 'Спирт', num: true, unit: true },
  { key: 'sugar', label: 'Сахара', num: true, unit: true },
  { key: 'titratedAcidity', label: 'Кислотность', num: true, unit: true },
  { key: 'ph', label: 'pH', num: true },
];
const colTitle = (c) => (c.unit && unitOf(c.key) ? `${c.label}, ${unitOf(c.key)}` : c.label);

const $ = (sel) => document.querySelector(sel);
const form = $('#filters');
const thead = $('#samples-head');
const tbody = $('#samples-body');
const table = $('#samples');
const emptyNote = $('#empty');
const countNote = $('#result-count');
const sortSelect = $('#f-sort');
const dialog = $('#sample-dialog');

let state = readState(window.location.search);
let opener = null;

// ── Маленькие помощники для DOM ──────────────────────────────────────────

/** Элемент с атрибутами; дети-строки становятся текстом (никакого HTML из данных). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** Иконка из постоянной строки (не данные). */
function svg(name, cls) {
  const t = document.createElement('template');
  t.innerHTML = icon(name, cls);
  return t.content.firstElementChild;
}

function emptyMark() {
  return el('span', { class: 'empty-value' }, el('span', { 'aria-hidden': 'true' }, '—'), el('span', { class: 'visually-hidden' }, 'нет данных'));
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Таблица ──────────────────────────────────────────────────────────────

function idCell(cell, s) {
  const what = [varietyLabel(s), s.harvestYear].filter(Boolean).join(', ');
  cell.append(el('button', { type: 'button', class: 'row-open', 'data-open': s.id, 'aria-label': `Образец № ${s.id}: ${what}` }, String(s.id)));
}

function varietyCell(cell, s) {
  cell.append(el('span', { class: s.varieties.length ? 'variety' : 'variety variety--unknown' }, varietyLabel(s)));
  if (s.varieties.length > 1) cell.append(' ', el('span', { class: 'tag' }, 'купаж'));
  if (s.name) cell.append(el('span', { class: 'cell-sub' }, s.name));
}

function colorCell(cell, s) {
  if (!s.color) return cell.append(emptyMark());
  const mod = { белое: 'white', красное: 'red', розовое: 'rose' }[s.color] ?? 'none';
  cell.append(el('span', { class: `swatch swatch--${mod}`, 'aria-hidden': 'true' }), s.color);
}

function renderRow(s) {
  const tr = el('tr', { 'data-id': s.id, role: 'row' });
  for (const col of COLUMNS) {
    const cell = el(col.rowHeader ? 'th' : 'td', {
      scope: col.rowHeader ? 'row' : null,
      role: col.rowHeader ? 'rowheader' : 'cell',
      class: [col.num && 'num', `col-${col.key}`].filter(Boolean).join(' '),
      'data-label': colTitle(col),
    });
    if (col.cell) col.cell(cell, s);
    else {
      const v = col.num ? formatNumber(s[col.key]) : s[col.key];
      cell.append(v === '' || v === null || v === undefined ? emptyMark() : String(v));
    }
    tr.append(cell);
  }
  return tr;
}

function buildHead() {
  for (const col of COLUMNS) {
    const unit = col.unit ? unitOf(col.key) : '';
    const button = el('button', { type: 'button', class: 'sort-button', 'data-sort': col.key },
      el('span', { class: 'sort-button__label' }, col.label, unit ? el('span', { class: 'sort-button__unit' }, unit) : null),
      svg('sort', 'icon sort-icon'));
    thead.append(el('th', { scope: 'col', role: 'columnheader', class: [col.num && 'num', `col-${col.key}`].filter(Boolean).join(' '), 'data-sort': col.key }, button));
  }
}

function updateHeadSort() {
  for (const th of thead.children) {
    const active = th.dataset.sort === state.sort;
    if (active) th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
    const iconName = !active ? 'sort' : state.dir === 'asc' ? 'sortAsc' : 'sortDesc';
    th.querySelector('.sort-icon').replaceWith(svg(iconName, 'icon sort-icon'));
  }
}

// ── Фильтры и сортировка ─────────────────────────────────────────────────

function fillSelects() {
  const options = filterOptions(SAMPLES);
  for (const key of Object.keys(SELECT_FILTERS)) {
    const select = form.elements[key];
    for (const { value, count } of options[key]) {
      const text = key === 'color' || key === 'type' ? capitalize(value) : value;
      select.append(el('option', { value }, `${text} (${count})`));
    }
    // значение из адреса, которого нет в списке, — отбрасываем
    if (state[key] && !options[key].some((o) => o.value === state[key])) state[key] = '';
    select.value = state[key];
  }
  form.elements.q.value = state.q;

  for (const col of COLUMNS) {
    for (const dir of ['asc', 'desc']) {
      const text = `${col.label} — ${dir === 'asc' ? 'по возрастанию' : 'по убыванию'}`;
      sortSelect.append(el('option', { value: `${col.key}:${dir}` }, text));
    }
  }
}

function sortDescription() {
  const col = COLUMNS.find((c) => c.key === state.sort);
  return `${col.label}, ${state.dir === 'asc' ? 'по возрастанию' : 'по убыванию'}`;
}

function render() {
  const rows = sortSamples(filterSamples(SAMPLES, state), state.sort, state.dir);
  const fragment = document.createDocumentFragment();
  for (const s of rows) fragment.append(renderRow(s));
  tbody.replaceChildren(fragment);

  table.hidden = rows.length === 0;
  emptyNote.hidden = rows.length > 0;
  const total = SAMPLES.length;
  const found = rows.length === total
    ? `Показаны все ${total} ${plural(total, ['образец', 'образца', 'образцов'])}`
    : `Найдено: ${rows.length} из ${total}`;
  countNote.textContent = `${found} · сортировка: ${sortDescription()}`;

  updateHeadSort();
  sortSelect.value = `${state.sort}:${state.dir}`;
  syncUrl();
}

function syncUrl() {
  const url = window.location.pathname + writeState(state) + window.location.hash;
  window.history.replaceState(null, '', url);
}

function setSort(key, dir) {
  state.sort = key;
  state.dir = dir;
  render();
}

// ── Карточка образца (<dialog>) ──────────────────────────────────────────

function valueNode(s, key) {
  const v = s[key];
  const field = FIELDS.get(key);
  const isNum = field?.type === 'number' || field?.type === 'int';
  const text = isNum ? formatNumber(v) : v;
  const dd = el('dd', {}, el('span', { class: isNum ? 'num' : null }, String(text)));
  if (field?.unit) dd.append(' ', el('span', { class: 'unit' }, field.unit));
  for (const note of (s.notes ?? []).filter((n) => n.field === key)) {
    dd.append(el('p', { class: 'note' }, svg('info', 'icon'), el('span', {}, note.text)));
  }
  return dd;
}

/** Список «подпись — значение»; пустые поля — одной строкой «Нет данных: …». */
function fieldList(s, keys, extraRows = []) {
  const dl = el('dl', { class: 'kv' });
  for (const [label, dd] of extraRows) dl.append(el('div', { class: 'kv__row' }, el('dt', {}, label), dd));
  const missing = [];
  for (const key of keys) {
    const v = s[key];
    if (v === null || v === undefined || v === '') {
      missing.push(FIELDS.get(key).label);
      continue;
    }
    dl.append(el('div', { class: 'kv__row' }, el('dt', {}, FIELDS.get(key).label), valueNode(s, key)));
  }
  const nodes = [dl];
  if (missing.length) nodes.push(el('p', { class: 'missing' }, `Нет данных: ${missing.join(', ')}.`));
  return nodes;
}

function dialogBody(s) {
  const keysOf = (pred) => data.fields.filter(pred).map((f) => f.key);
  const blocks = [];

  blocks.push(el('section', { class: 'dlg-block' }, el('h3', {}, ORG_BLOCK), ...fieldList(s, keysOf((f) => f.block === ORG_BLOCK))));

  // Сортовой состав: канонические сорта; если в журнале записано иначе — показываем и запись.
  const composition = el('dd', {}, varietyLabel(s));
  const raw = (s.varietyRaw ?? '').replace(/\s+/g, ' ').trim();
  if (raw && raw !== s.varieties.join(', ')) composition.append(el('span', { class: 'cell-sub' }, `в исходных данных: «${raw}»`));
  blocks.push(el('section', { class: 'dlg-block' }, el('h3', {}, TECH_BLOCK),
    ...fieldList(s, keysOf((f) => f.block === TECH_BLOCK), [['Сортовой состав', composition]])));

  const analytic = el('section', { class: 'dlg-block' }, el('h3', {}, ANALYTIC_BLOCK));
  const sections = [...new Set(data.fields.filter((f) => f.block === ANALYTIC_BLOCK).map((f) => f.section))];
  for (const section of sections) {
    analytic.append(el('h4', {}, section));
    const subs = [...new Set(data.fields.filter((f) => f.section === section).map((f) => f.subsection))];
    for (const sub of subs) {
      if (subs.length > 1 && sub) analytic.append(el('h5', {}, sub));
      analytic.append(...fieldList(s, keysOf((f) => f.section === section && f.subsection === sub)));
    }
  }
  blocks.push(analytic);
  return blocks;
}

function openSample(id, trigger) {
  const s = BY_ID.get(id);
  if (!s) {
    state.id = null;
    syncUrl();
    return;
  }
  $('#dlg-number').textContent = `Образец № ${s.id}`;
  $('#dlg-title').textContent = varietyLabel(s);
  $('#dlg-meta').textContent = [s.harvestYear && `урожай ${s.harvestYear}`, s.color, s.productType].filter(Boolean).join(' · ');
  $('#dlg-body').replaceChildren(...dialogBody(s));
  opener = trigger ?? null;
  state.id = id;
  syncUrl();
  if (!dialog.open) dialog.showModal();
  $('#dlg-body').scrollTop = 0;
}

function onDialogClose() {
  const id = state.id;
  state.id = null;
  syncUrl();
  // возврат фокуса туда, откуда открыли (или на кнопку строки, если карточка открыта по ссылке)
  const target = opener?.isConnected ? opener : tbody.querySelector(`[data-open="${id}"]`);
  target?.focus();
  opener = null;
}

// ── События ──────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function bindEvents() {
  form.addEventListener('submit', (e) => e.preventDefault());
  form.elements.q.addEventListener('input', debounce(() => { state.q = form.elements.q.value; render(); }, 200));
  for (const key of Object.keys(SELECT_FILTERS)) {
    form.elements[key].addEventListener('change', (e) => { state[key] = e.target.value; render(); });
  }
  sortSelect.addEventListener('change', () => {
    const [key, dir] = sortSelect.value.split(':');
    setSort(key, dir);
  });
  form.addEventListener('reset', () => {
    // браузер сбрасывает поля после события — состояние меняем следом
    setTimeout(() => { state = { ...DEFAULT_STATE }; render(); }, 0);
  });

  thead.addEventListener('click', (e) => {
    const button = e.target.closest('.sort-button');
    if (!button) return;
    const key = button.dataset.sort;
    setSort(key, state.sort === key && state.dir === 'asc' ? 'desc' : 'asc');
  });

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    if (e.target.closest('a')) return;
    const button = row.querySelector('.row-open');
    openSample(Number(row.dataset.id), button);
  });

  $('#dlg-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', onDialogClose);
  // щелчок по затемнённому фону вокруг карточки закрывает её
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}

// ── Запуск ───────────────────────────────────────────────────────────────

buildHead();
fillSelects();
bindEvents();
render();
if (state.id !== null) openSample(state.id, null);
