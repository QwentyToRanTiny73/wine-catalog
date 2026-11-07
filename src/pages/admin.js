// /admin/ — правка дескрипторов ароматов и пометок к образцам (решения Р2, Р27).
// Сохранение — коммит CSV в main через GitHub API; сайт пересобирается GitHub Actions.
// Значения анализов здесь не правятся: их источник — Excel (Р27).
import taxonomy from '../data/aroma/taxonomy.json';
import aroma from '../data/aroma/varieties.json';
import samples from '../data/samples.json';
import { parseCsv, serializeCsv } from '../lib/csv.js';
import { checkToken, readFile, writeFile, REPO } from '../lib/github.js';

const AROMA_PATH = 'data/aroma-descriptors.csv';
const NOTES_PATH = 'data/sample-notes.csv';
const TOKEN_KEY = 'wine-catalog-admin-token';
const STATUSES = ['интернет, проверить', 'проверено', 'скрыто'];
const VARIETIES = Object.keys(aroma.varieties);
const GROUPS = taxonomy.categories.flatMap((c) => c.groups);
const DESCRIPTORS = new Set(GROUPS.flatMap((g) => g.descriptors.map((d) => d.name)));
const FIELDS = new Map(samples.fields.map((f) => [f.key, f.label]));
const BY_NUMBER = new Map(samples.samples.filter((s) => s.labNumber != null).map((s) => [s.labNumber, s]));
const isHttp = (url) => /^https?:\/\//.test(url);   // как build_aroma.py: url.startswith(('http://', 'https://'))
/** Сегодняшняя дата по часам компьютера (toISOString дал бы дату по UTC — ночью в Крыму это вчера). */
const today = () => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-'); };

const $ = (sel) => document.querySelector(sel);
let token = null;
const files = { aroma: null, notes: null };   // { header, rows, sha, dirty, edits, saving }

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

const options = (values, selected) => values.map((v) => el('option', { value: v, selected: String(v) === String(selected) }, String(v)));

function setStatus(id, text, link = null) {
  $(id).replaceChildren(text, ...(link ? [' ', el('a', { href: link, rel: 'noopener', target: '_blank' }, 'коммит на GitHub')] : []));
}

function markDirty(kind) {
  const f = files[kind];
  f.dirty = true;
  f.edits += 1;   // по счётчику save() видит правки, сделанные во время сохранения
  $(`#${kind}-save`).disabled = f.saving;
  setStatus(`#${kind}-status`, 'Есть несохранённые изменения.');
}

// ── Вход ─────────────────────────────────────────────────────────────────

async function login(candidate) {
  setStatus('#login-status', 'Проверяю токен…');
  try {
    await checkToken(candidate);
    token = candidate;
    sessionStorage.setItem(TOKEN_KEY, token);
    const [a, n] = await Promise.all([readFile(token, AROMA_PATH), readFile(token, NOTES_PATH)]);
    files.aroma = { ...parseCsv(a.text), sha: a.sha, dirty: false, edits: 0, saving: false };
    files.notes = { ...parseCsv(n.text), sha: n.sha, dirty: false, edits: 0, saving: false };
    $('#login').hidden = true;
    $('#editor').hidden = false;
    $('#who').textContent = `Вход выполнен · ${REPO}, ветка main`;
    renderAroma();
    renderNotes();
  } catch (e) {
    sessionStorage.removeItem(TOKEN_KEY);
    setStatus('#login-status', `Не удалось войти: ${e.message}.`);
  }
}

// ── Дескрипторы ароматов ─────────────────────────────────────────────────

function renderAroma() {
  const variety = $('#aroma-variety').value || VARIETIES[0];
  const tbody = $('#aroma-table tbody');
  const rows = files.aroma.rows.filter((r) => r.variety === variety);
  tbody.replaceChildren(...rows.map((r) => {
    const intensity = el('select', { 'aria-label': `Интенсивность: ${r.descriptor}` }, ...options([1, 2, 3], r.intensity));
    intensity.addEventListener('change', () => { r.intensity = intensity.value; markDirty('aroma'); });
    const status = el('select', { 'aria-label': `Статус: ${r.descriptor}` }, ...options(STATUSES, r.status));
    status.addEventListener('change', () => { r.status = status.value; markDirty('aroma'); });
    return el('tr', {}, el('td', {}, r.descriptor), el('td', {}, intensity), el('td', {}, status),
      // ссылка — только http(s): строку «скрыто» сборка не проверяет, а здесь хранится токен
      el('td', {}, isHttp(r.source_url) ? el('a', { href: r.source_url, rel: 'noopener', target: '_blank' }, r.source_title || r.source_url) : (r.source_title || r.source_url)));
  }));
  if (!rows.length) tbody.append(el('tr', {}, el('td', { colspan: 4 }, 'У этого сорта пока нет дескрипторов.')));
}

function addAroma(e) {
  e.preventDefault();
  const v = (id) => $(id).value.trim();
  const row = {
    variety: v('#add-variety'), descriptor: v('#add-descriptor'), intensity: v('#add-intensity'),
    compound: v('#add-compound'), quote: v('#add-quote'), source_title: v('#add-title'), source_url: v('#add-url'),
    source_type: v('#add-type'), accessed: today(), note: v('#add-note'),
    status: 'проверено',   // добавляет сама лаборатория
  };
  // те же правила, что в scripts/build_aroma.py: без источника записи нет (Р10)
  const problem = !VARIETIES.includes(row.variety) ? 'сорт не из списка'
    : !DESCRIPTORS.has(row.descriptor) ? 'тон не из таксономии'
    : !['1', '2', '3'].includes(row.intensity) ? 'интенсивность — 1, 2 или 3'
      : !isHttp(row.source_url) ? 'нужна ссылка на источник (https://…)'
        : !row.quote ? 'нужна цитата из источника' : null;
  if (problem) { setStatus('#aroma-status', `Не добавлено: ${problem}.`); return; }
  files.aroma.rows.push(row);
  $('#aroma-variety').value = row.variety;
  e.target.reset();
  renderAroma();
  markDirty('aroma');
}

// ── Пометки к образцам ───────────────────────────────────────────────────

function renderNotes() {
  const tbody = $('#notes-table tbody');
  tbody.replaceChildren(...files.notes.rows.map((r, i) => {
    const del = el('button', { type: 'button', class: 'link-button', 'aria-label': `Удалить пометку к образцу ${r.labNumber}` }, 'Удалить');
    del.addEventListener('click', () => {
      files.notes.rows.splice(i, 1);
      renderNotes();
      markDirty('notes');
      // кнопка исчезла вместе со строкой — фокус на соседнюю «Удалить» или на форму, а не в начало страницы
      const buttons = tbody.querySelectorAll('button');
      (buttons[Math.min(i, buttons.length - 1)] ?? $('#note-number')).focus();
    });
    return el('tr', {}, el('td', {}, r.labNumber), el('td', {}, FIELDS.get(r.field) ?? r.field), el('td', {}, r.note), el('td', {}, del));
  }));
}

function addNote(e) {
  e.preventDefault();
  const number = Number($('#note-number').value);
  const field = $('#note-field').value;
  const note = $('#note-text').value.trim();
  const sample = BY_NUMBER.get(number);
  // те же правила, что в scripts/build_notes.py
  const problem = !sample ? `образца с номером ${number} нет (у образцов «б/н» пометок быть не может)`
    : !FIELDS.has(field) ? 'поле не показывается на сайте'
      : (sample[field] ?? '') === '' ? `у образца ${number} поле «${FIELDS.get(field)}» не заполнено — пометку никто не увидит`
        : !note ? 'пустой текст' : null;
  if (problem) { setStatus('#notes-status', `Не добавлено: ${problem}.`); return; }
  files.notes.rows.push({ labNumber: String(number), field, note });
  e.target.reset();
  renderNotes();
  markDirty('notes');
}

// ── Сохранение ───────────────────────────────────────────────────────────

async function save(kind, path) {
  const f = files[kind];
  const button = $(`#${kind}-save`);
  const edits = f.edits;
  f.saving = true;
  button.disabled = true;
  setStatus(`#${kind}-status`, 'Сохраняю…');
  try {
    const res = await writeFile(token, path, serializeCsv(f.header, f.rows), f.sha, $(`#${kind}-message`).value.trim() || `admin: ${path}`);
    f.sha = res.sha;
    // правки, сделанные пока шло сохранение, в этот коммит не попали — они остаются несохранёнными
    f.dirty = f.edits !== edits;
    setStatus(`#${kind}-status`, f.dirty ? 'Сохранено, но есть правки, сделанные во время сохранения, — сохраните ещё раз.'
      : 'Сохранено. Сайт обновится через 1–2 минуты (сборка GitHub Actions).', res.commitUrl);
  } catch (e) {
    setStatus(`#${kind}-status`, `Не сохранено: ${e.message}.`);
  } finally {
    f.saving = false;
    button.disabled = !f.dirty;
  }
}

// ── Запуск ───────────────────────────────────────────────────────────────

$('#aroma-variety').append(...options(VARIETIES));
$('#add-variety').append(...options(VARIETIES));
$('#add-descriptor').append(...GROUPS.map((g) => el('optgroup', { label: g.name }, ...options(g.descriptors.map((d) => d.name)))));
$('#note-field').append(...[...FIELDS].map(([key, label]) => el('option', { value: key }, label)));

$('#login').addEventListener('submit', (e) => { e.preventDefault(); login($('#token').value.trim()); });
$('#logout').addEventListener('click', () => { sessionStorage.removeItem(TOKEN_KEY); window.location.reload(); });
$('#aroma-variety').addEventListener('change', renderAroma);
$('#aroma-add').addEventListener('submit', addAroma);
$('#notes-add').addEventListener('submit', addNote);
$('#aroma-save').addEventListener('click', () => save('aroma', AROMA_PATH));
$('#notes-save').addEventListener('click', () => save('notes', NOTES_PATH));
window.addEventListener('beforeunload', (e) => { if (files.aroma?.dirty || files.notes?.dirty) e.preventDefault(); });

const saved = sessionStorage.getItem(TOKEN_KEY);
if (saved) login(saved);
