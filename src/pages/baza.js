// /baza/ — единственная таблица образцов.
// Данные выводятся только через textContent; innerHTML — лишь для постоянных SVG-иконок.
import data from '../data/samples.json';
import { filterSamples, sortSamples, filterOptions, readState, writeState, SELECT_FILTERS, DEFAULT_STATE } from '../lib/query.js';
import { formatNumber, varietyLabel, plural, sampleTitle, sampleNumber, isEmpty, capitalize } from '../lib/format.js';
import { COLUMNS } from '../lib/columns.js';
import { BLOCKS, colorKey, SAMPLE_WORDS } from '../lib/domain.js';
import { icon } from '../site/icons.js';
import { pageUrl } from '../site/site.js';
import { MAX_COMPARE } from '../lib/wheel.js';

const SAMPLES = data.samples;
const BY_ID = new Map(SAMPLES.map((s) => [s.id, s]));
const FIELDS = new Map(data.fields.map((f) => [f.key, f]));
const DIR_LABEL = { asc: 'по возрастанию', desc: 'по убыванию' };

const $ = (sel) => document.querySelector(sel);
const form = $('#filters');
const thead = $('#samples-head');
const tbody = $('#samples-body');
const table = $('#samples');
const emptyNote = $('#empty');
const countNote = $('#result-count');
const sortSelect = $('#f-sort');
const dialog = $('#sample-dialog');
const dlgBody = $('#dlg-body');

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

/** Иконка из постоянной строки (не данные): разбирается один раз, дальше — копии. */
const iconCache = new Map();
function svg(name, cls = 'icon') {
  const key = `${name}|${cls}`;
  if (!iconCache.has(key)) {
    const t = document.createElement('template');
    t.innerHTML = icon(name, cls);
    iconCache.set(key, t.content.firstElementChild);
  }
  return iconCache.get(key).cloneNode(true);
}

function emptyMark() {
  return el('span', { class: 'empty-value' }, el('span', { 'aria-hidden': 'true' }, '—'), el('span', { class: 'visually-hidden' }, 'нет данных'));
}

// ── Таблица ──────────────────────────────────────────────────────────────

const CELLS = {
  id(cell, s) {
    const what = [varietyLabel(s), s.harvestYear].filter(Boolean).join(', ');
    // имя кнопки начинается с видимого текста («113» / «б/н») — WCAG 2.5.3
    const name = s.labNumber == null ? `Образец б/н (без номера): ${what}` : `${sampleTitle(s)}: ${what}`;
    cell.append(el('button', { type: 'button', class: 'row-open', 'data-open': s.id, 'aria-label': name }, sampleNumber(s)));
  },
  variety(cell, s) {
    cell.append(el('span', { class: s.varieties.length ? 'variety' : 'variety variety--unknown' }, varietyLabel(s)));
    if (s.varieties.length > 1) cell.append(' ', el('span', { class: 'tag' }, 'купаж'));
    if (s.name) cell.append(el('span', { class: 'cell-sub' }, s.name));
  },
  color(cell, s) {
    if (!s.color) return cell.append(emptyMark());
    cell.append(el('span', { class: `swatch swatch--${colorKey(s.color)}`, 'aria-hidden': 'true' }), s.color);
  },
};

// Всё, что зависит только от колонки, — один раз, а не в каждой ячейке
const COLUMN_VIEW = COLUMNS.map((col) => {
  const unit = col.unit ? FIELDS.get(col.key)?.unit ?? '' : '';
  return {
    ...col,
    unit,
    cls: [col.num && 'num mono', `col-${col.key}`].filter(Boolean).join(' '),
    title: unit ? `${col.label}, ${unit}` : col.label,
  };
});

function renderRow(s) {
  const tr = el('tr', { 'data-id': s.id, role: 'row' });
  for (const col of COLUMN_VIEW) {
    const cell = el(col.rowHeader ? 'th' : 'td', {
      scope: col.rowHeader ? 'row' : null,
      role: col.rowHeader ? 'rowheader' : 'cell',
      class: col.cls,
      'data-label': col.title,
    });
    if (CELLS[col.key]) CELLS[col.key](cell, s);
    else {
      const v = col.num ? formatNumber(s[col.key]) : s[col.key];
      cell.append(isEmpty(v) ? emptyMark() : String(v));
    }
    tr.append(cell);
  }
  return tr;
}

// Данные не меняются: строки строятся один раз, фильтр и сортировка только переставляют их
const ROWS = new Map(SAMPLES.map((s) => [s.id, renderRow(s)]));

function buildHead() {
  for (const col of COLUMN_VIEW) {
    const button = el('button', { type: 'button', class: 'sort-button', 'data-sort': col.key },
      el('span', { class: 'sort-button__label' }, col.label, col.unit ? el('span', { class: 'sort-button__unit' }, col.unit) : null),
      svg('sort', 'icon sort-icon'));
    thead.append(el('th', { scope: 'col', role: 'columnheader', class: col.cls, 'data-sort': col.key }, button));
  }
}

let shownSort = '';
function updateHeadSort() {
  const current = `${state.sort}:${state.dir}`;
  if (current === shownSort) return;
  shownSort = current;
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
  for (const [key, filter] of Object.entries(SELECT_FILTERS)) {
    const select = form.elements[key];
    for (const { value, count } of options[key]) {
      select.append(el('option', { value }, `${filter.capitalize ? capitalize(value) : value} (${count})`));
    }
    // значение из адреса, которого нет в списке, — отбрасываем
    if (state[key] && !options[key].some((o) => o.value === state[key])) state[key] = '';
    select.value = state[key];
  }
  form.elements.q.value = state.q;

  for (const col of COLUMNS) {
    for (const dir of Object.keys(DIR_LABEL)) {
      sortSelect.append(el('option', { value: `${col.key}:${dir}` }, `${col.label} — ${DIR_LABEL[dir]}`));
    }
  }
}

function render() {
  const rows = sortSamples(filterSamples(SAMPLES, state), state.sort, state.dir);
  tbody.replaceChildren(...rows.map((s) => ROWS.get(s.id)));

  table.hidden = rows.length === 0;
  emptyNote.hidden = rows.length > 0;
  const total = SAMPLES.length;
  const found = rows.length === total
    ? `Показаны все ${total} ${plural(total, SAMPLE_WORDS)}`
    : `Найдено: ${rows.length} из ${total}`;
  const sortCol = COLUMNS.find((c) => c.key === state.sort);
  countNote.textContent = `${found} · сортировка: ${sortCol.label}, ${DIR_LABEL[state.dir]}`;

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

function valueNode(s, field) {
  let dd;
  if (field.type === 'varieties') {
    // канонические сорта; если в исходных данных записано иначе — показываем и запись
    dd = el('dd', {}, varietyLabel(s));
    const raw = String(s.varietyRaw).replace(/\s+/g, ' ').trim();
    if (raw !== s.varieties.join(', ')) dd.append(el('span', { class: 'cell-sub' }, `в исходных данных: «${raw}»`));
  } else {
    const isNum = field.type === 'number' || field.type === 'int';
    dd = el('dd', {}, el('span', { class: isNum ? 'mono' : null }, String(isNum ? formatNumber(s[field.key]) : s[field.key])));
    if (field.unit) dd.append(' ', el('span', { class: 'unit' }, field.unit));
  }
  for (const note of (s.notes ?? []).filter((n) => n.field === field.key)) {
    dd.append(el('p', { class: 'note' }, svg('info'), el('span', {}, note.text)));
  }
  return dd;
}

/** Список «подпись — значение»; пустые поля — одной строкой «Нет данных: …». */
function fieldList(s, fields) {
  const dl = el('dl', { class: 'kv' });
  const missing = [];
  for (const field of fields) {
    if (isEmpty(s[field.key])) missing.push(field.label);
    else dl.append(el('div', { class: 'kv__row' }, el('dt', {}, field.label), valueNode(s, field)));
  }
  return missing.length ? [dl, el('p', { class: 'missing' }, `Нет данных: ${missing.join(', ')}.`)] : [dl];
}

const blockHeading = (text) => el('h3', { class: 'overline' }, text);

function dialogBody(s) {
  const fieldsOf = (pred) => data.fields.filter(pred);
  const blocks = [BLOCKS.org, BLOCKS.tech].map((block) =>
    el('section', { class: 'dlg-block' }, blockHeading(block), ...fieldList(s, fieldsOf((f) => f.block === block))));

  const analytic = el('section', { class: 'dlg-block' }, blockHeading(BLOCKS.analytic));
  const sections = [...new Set(fieldsOf((f) => f.block === BLOCKS.analytic).map((f) => f.section))];
  for (const section of sections) {
    analytic.append(el('h4', {}, section));
    const subs = [...new Set(fieldsOf((f) => f.section === section).map((f) => f.subsection))];
    for (const sub of subs) {
      if (subs.length > 1 && sub) analytic.append(el('h5', {}, sub));
      analytic.append(...fieldList(s, fieldsOf((f) => f.section === section && f.subsection === sub)));
    }
  }
  return [...blocks, analytic];
}

function openSample(id, trigger) {
  const s = BY_ID.get(id);
  if (!s) {
    state.id = null;
    syncUrl();
    return;
  }
  $('#dlg-number').textContent = sampleTitle(s);
  $('#dlg-title').textContent = varietyLabel(s);
  $('#dlg-meta').textContent = [s.harvestYear && `урожай ${s.harvestYear}`, s.color, s.productType].filter(Boolean).join(' · ');
  // ссылка на профиль аромата сорта (у купажа — сравнение его сортов, до трёх)
  const aromaVarieties = s.varieties.slice(0, MAX_COMPARE);
  $('#dlg-aroma').replaceChildren(...(aromaVarieties.length ? [el('a', { href: `${pageUrl('aromaty')}?v=${encodeURIComponent(aromaVarieties.join(','))}` },
    aromaVarieties.length > 1 ? 'Профили аромата сортов' : 'Профиль аромата сорта')] : []));
  dlgBody.replaceChildren(...dialogBody(s));
  opener = trigger ?? null;
  state.id = id;
  syncUrl();
  if (!dialog.open) dialog.showModal();
  dlgBody.scrollTop = 0;
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
    if (row) openSample(Number(row.dataset.id), row.querySelector('.row-open'));
  });

  $('#dlg-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', onDialogClose);
  // щелчок по затемнённому фону закрывает карточку; если выделяли текст и отпустили мышь на фоне — нет
  let pressedOnBackdrop = false;
  dialog.addEventListener('mousedown', (e) => { pressedOnBackdrop = e.target === dialog; });
  dialog.addEventListener('click', (e) => { if (e.target === dialog && pressedOnBackdrop) dialog.close(); });
}

// ── Запуск ───────────────────────────────────────────────────────────────

buildHead();
fillSelects();
bindEvents();
render();
if (state.id !== null) openSample(state.id, null);
