/**
 * table.js — SheetJS loader, paginated table renderer, modal
 * Загрузка Excel с сервера, постраничное отображение, модальное окно
 */
'use strict';

/* ── Config ─────────────────────────────────────────── */
const EXCEL_PATH = 'data/analytical_data.xlsx';
const PAGE_SIZE  = 30;   // строк на страницу

/* ── Excel column → field mapping ───────────────────── */
// Все ключи — нижний регистр с trim()
const COL_MAP = {
  // Организационный
  'дата исследования':                                      'researchDate',
  'виноградо-винодельческий район по сро':                 'district',
  'природно-климатическая зона выращивания винограда':     'climateZone',
  'природно-климатический район выращивания винограда':    'climateRegion',
  'административный район выращивания винграда':           'adminRegion',
  'место расположение виноградника (населенный пункт)':    'location',
  'производитель винограда (хозяйство)':                   'grapeProducer',
  'производитель вина (винодельня)':                       'winery',
  // Технический
  'тип винодельческой продукции':   'productType',
  'наименование образца':           'name',
  'сортовой состав':                'sort',
  'год урожая':                     'year',
  'цвет':                           'color',
  // Аналитический — ГОСТ
  'объемная доля этилового спирта': 'alcohol',
  'приведенный экстракт':           'reducedExtract',
  'титруемая кислотность':          'titratedAcidity',
  'сахара':                         'sugar',
  // Аналитический — дополнительные
  'лимонная кислота':               'citricAcid',
  'винная кислота':                 'tartaricAcid',
  'яблочная кислота':               'malicAcid',
  'янтарная кислота':               'succinicAcid',
  'молочная кислота':               'lacticAcid',
  'уксусная кислота':               'aceticAcid',
  'биозы  (в пересчете на сахарозу)': 'bioses',
  'глюкоза':                        'glucose',
  'фруктоза':                       'fructose',
  'глицерин':                       'glycerin',
  'хлориды':                        'chlorides',
  'натрий':                         'sodium',
  'калий':                          'potassium',
  'магний':                         'magnesium',
  'кальций':                        'calcium',
  'сумма фенольных веществ':        'phenolicSubstances',
  'рн':                             'ph',
  'ph':                             'ph',
  'буферная емкость щелочью':       'bufferCapacity',
  'электропроводность':             'electricConductivity',
};

/* Показатели, регламентируемые ГОСТ (отображаются первыми) */
const GOST_FIELDS = [
  { key:'alcohol',          label:'Объёмная доля этил. спирта', unit:'% об.' },
  { key:'reducedExtract',   label:'Приведённый экстракт',       unit:'г/дм³' },
  { key:'titratedAcidity',  label:'Титруемая кислотность',      unit:'г/дм³' },
  { key:'sugar',            label:'Сахара',                     unit:'г/дм³' },
];

/* Дополнительные показатели */
const EXTRA_FIELDS = [
  { key:'citricAcid',          label:'Лимонная кислота',            unit:'г/дм³' },
  { key:'tartaricAcid',        label:'Винная кислота',              unit:'г/дм³' },
  { key:'malicAcid',           label:'Яблочная кислота',            unit:'г/дм³' },
  { key:'succinicAcid',        label:'Янтарная кислота',            unit:'г/дм³' },
  { key:'lacticAcid',          label:'Молочная кислота',            unit:'г/дм³' },
  { key:'aceticAcid',          label:'Уксусная кислота',            unit:'г/дм³' },
  { key:'bioses',              label:'Биозы (на сахарозу)',         unit:'г/дм³' },
  { key:'glucose',             label:'Глюкоза',                     unit:'г/дм³' },
  { key:'fructose',            label:'Фруктоза',                    unit:'г/дм³' },
  { key:'glycerin',            label:'Глицерин',                    unit:'г/дм³' },
  { key:'chlorides',           label:'Хлориды',                     unit:'мг/дм³' },
  { key:'sodium',              label:'Натрий',                      unit:'мг/дм³' },
  { key:'potassium',           label:'Калий',                       unit:'мг/дм³' },
  { key:'magnesium',           label:'Магний',                      unit:'мг/дм³' },
  { key:'calcium',             label:'Кальций',                     unit:'мг/дм³' },
  { key:'phenolicSubstances',  label:'Σ Фенольных веществ',         unit:'мг/дм³' },
  { key:'ph',                  label:'pH',                          unit:''       },
  { key:'bufferCapacity',      label:'Буферная ёмкость (щелочью)',  unit:'ммоль/дм³' },
  { key:'electricConductivity',label:'Электропроводность',          unit:'мСм/см' },
];

const COLOR_NORM = { 'б':'белое','к':'красное','р':'розовое' };
const TYPE_NORM  = { 'в':'вино','вм':'виноматериал' };

/* ── State ──────────────────────────────────────────── */
const state = {
  rows:        [],
  filtered:    [],
  page:        1,
  sortCol:     null,
  sortDir:     'asc',
  activeModal: null,
};

/* ════════════════════════════════════════════════════ */
/*  BOOT                                                */
/* ════════════════════════════════════════════════════ */
async function boot() {
  showLoader(true);

  // 1. Try loading from embedded JS data (instant, always works)
  if (Array.isArray(window.wineSamples) && window.wineSamples.length) {
    state.rows     = normaliseEmbedded(window.wineSamples);
    state.filtered = [...state.rows];
    populateFilters();
    renderTable();
    renderPagination();
    showLoader(false);
    // 2. Also try fresh Excel in background for updates
    tryLoadExcel();
    return;
  }

  // 3. No embedded data — must load Excel
  const ok = await tryLoadExcel();
  if (!ok) {
    showLoader(false);
    showError('Не удалось загрузить данные. Убедитесь, что файл data/analytical_data.xlsx доступен.');
  }
}

/* Convert embedded wineSamples (js/data.js field names) to table format */
function normaliseEmbedded(samples) {
  return samples.map((s, i) => ({
    _row:          i + 2,
    researchDate:  s.researchDate  || null,
    district:      s.wineDistrict  || null,
    climateZone:   s.climateZone   || null,
    climateRegion: s.climateRegion || null,
    adminRegion:   s.adminRegion   || null,
    location:      s.location      || null,
    grapeProducer: s.grapeProducer || null,
    winery:        s.winery        || null,
    productType:   s.productType   || null,
    name:          s.name          || null,
    sort:          s.sort          || null,
    year:          s.harvestYear   || null,
    color:         s.color         || null,
    alcohol:       s.alcohol       ?? null,
    reducedExtract:s.reducedExtract?? null,
    titratedAcidity: s.titratedAcidity ?? null,
    sugar:         s.sugar         ?? null,
    citricAcid:    s.citricAcid    ?? null,
    tartaricAcid:  s.tartaricAcid  ?? null,
    malicAcid:     s.malicAcid     ?? null,
    succinicAcid:  s.succinicAcid  ?? null,
    lacticAcid:    s.lacticAcid    ?? null,
    aceticAcid:    s.aceticAcid    ?? null,
    bioses:        s.bioses        ?? null,
    glucose:       s.glucose       ?? null,
    fructose:      s.fructose      ?? null,
    glycerin:      s.glycerin      ?? null,
    chlorides:     s.chlorides     ?? null,
    sodium:        s.sodium        ?? null,
    potassium:     s.potassium     ?? null,
    magnesium:     s.magnesium     ?? null,
    calcium:       s.calcium       ?? null,
    phenolicSubstances: s.phenolicSubstances ?? null,
    ph:            s.ph            ?? null,
    bufferCapacity:s.bufferCapacity?? null,
    electricConductivity: s.electricConductivity ?? null,
  }));
}

async function tryLoadExcel() {
  try {
    const r = await fetch(EXCEL_PATH);
    if (!r.ok) return false;
    const buf = await r.arrayBuffer();
    const wb  = XLSX.read(buf, { type:'array' });
    const wsName = wb.SheetNames.find(n => /форм|данн|лист/i.test(n)) || wb.SheetNames[0];
    const ws  = wb.Sheets[wsName];
    const rows = parseSheet(ws);
    if (!rows.length) return false;
    // Replace with fresh Excel data
    state.rows     = rows;
    state.filtered = [...state.rows];
    populateFilters();
    renderTable();
    renderPagination();
    showLoader(false);
    return true;
  } catch { return false; }
}

/* ════════════════════════════════════════════════════ */
/*  PARSE EXCEL SHEET                                   */
/* ════════════════════════════════════════════════════ */
function parseSheet(ws) {
  // Find header row (first row with "цвет" or "сортовой" in any cell)
  const range = XLSX.utils.decode_range(ws['!ref']);
  let headerRow = 0;
  outer: for (let r = range.s.r; r <= Math.min(range.s.r + 6, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell && /цвет|сортов|спирт/i.test(String(cell.v || ''))) {
        headerRow = r;
        break outer;
      }
    }
  }

  // Collect headers from headerRow
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({r: headerRow, c})];
    headers.push(cell ? String(cell.v || '').toLowerCase().trim() : '');
  }

  // Map header index → JS key
  const colIdx = {};
  headers.forEach((h, i) => {
    const jsKey = COL_MAP[h];
    if (jsKey && !(jsKey in colIdx)) colIdx[i] = jsKey;
  });

  // Parse data rows — read lazily chunk by chunk
  const rows = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const rec = { _row: r };
    let hasData = false;

    Object.entries(colIdx).forEach(([ci, key]) => {
      const cell = ws[XLSX.utils.encode_cell({r, c: Number(ci)})];
      if (!cell || cell.v === null || cell.v === undefined) {
        rec[key] = null;
        return;
      }
      hasData = true;
      if (key === 'researchDate') {
        // Could be a date serial or string
        if (typeof cell.v === 'number') {
          const d = XLSX.SSF.parse_date_code(cell.v);
          rec[key] = `${String(d.d).padStart(2,'0')}.${String(d.m).padStart(2,'0')}.${d.y}`;
        } else {
          rec[key] = String(cell.v).trim();
        }
      } else if (key === 'year') {
        rec[key] = parseInt(cell.v, 10) || null;
      } else if (key === 'color') {
        const s = String(cell.v).trim().toLowerCase();
        rec[key] = COLOR_NORM[s] || s;
      } else if (key === 'productType') {
        const s = String(cell.v).trim().toLowerCase();
        rec[key] = TYPE_NORM[s] || s;
      } else if (['sort','name','district','climateZone','climateRegion','adminRegion',
                  'location','grapeProducer','winery'].includes(key)) {
        rec[key] = String(cell.v).trim() || null;
      } else {
        // numeric
        const n = parseFloat(cell.v);
        rec[key] = isNaN(n) ? null : Math.round(n * 10000) / 10000;
      }
    });

    if (hasData) rows.push(rec);
  }
  return rows;
}

/* ════════════════════════════════════════════════════ */
/*  FILTERS                                             */
/* ════════════════════════════════════════════════════ */
function populateFilters() {
  const years   = [...new Set(state.rows.map(r => r.year).filter(Boolean))].sort((a,b)=>b-a);
  const colors  = [...new Set(state.rows.map(r => r.color).filter(Boolean))].sort();
  const regions = [...new Set(state.rows.map(r => r.adminRegion || r.district).filter(Boolean))].sort();

  fillSel('filterYear',   years);
  fillSel('filterColor',  colors);
  fillSel('filterRegion', regions);
}

function fillSel(id, vals) {
  const sel = document.getElementById(id);
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  vals.forEach(v => {
    const o = document.createElement('option');
    o.value = o.textContent = v;
    sel.appendChild(o);
  });
}

function applyFilters() {
  const q      = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const year   = document.getElementById('filterYear')?.value   || '';
  const color  = document.getElementById('filterColor')?.value  || '';
  const region = document.getElementById('filterRegion')?.value || '';

  state.filtered = state.rows.filter(r => {
    if (year   && String(r.year  || '') !== year)        return false;
    if (color  && (r.color || '')       !== color)       return false;
    if (region && (r.adminRegion || r.district || '') !== region) return false;
    if (q) {
      const hay = [r.name, r.sort, r.color, r.district, r.adminRegion,
                   r.location, r.grapeProducer, r.winery, r.year]
        .map(v => String(v||'').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  state.page = 1;
  renderTable();
  renderPagination();
  const cnt = document.getElementById('resultCount');
  if (cnt) cnt.textContent = state.filtered.length;
}

/* ════════════════════════════════════════════════════ */
/*  SORT                                                */
/* ════════════════════════════════════════════════════ */
function applySort(col) {
  if (state.sortCol === col) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortCol = col;
    state.sortDir = 'asc';
  }
  // Update th indicators
  document.querySelectorAll('#wineTable thead th[data-col]').forEach(th => {
    th.classList.remove('th-asc','th-desc');
    if (th.dataset.col === col)
      th.classList.add(state.sortDir === 'asc' ? 'th-asc' : 'th-desc');
  });
  state.filtered.sort((a,b) => {
    let av = a[col] ?? '', bv = b[col] ?? '';
    if (typeof av==='number'&&typeof bv==='number')
      return state.sortDir==='asc' ? av-bv : bv-av;
    av=String(av).toLowerCase(); bv=String(bv).toLowerCase();
    return state.sortDir==='asc' ? av.localeCompare(bv,'ru') : bv.localeCompare(av,'ru');
  });
  renderTable();
}

/* ════════════════════════════════════════════════════ */
/*  TABLE RENDER (paginated)                            */
/* ════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById('wineTableBody');
  if (!tbody) return;

  const start = (state.page - 1) * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">
      <span>🔍 Ничего не найдено. Измените параметры поиска.</span>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map((r, i) => {
    const idx    = start + i + 1;
    const region = buildRegion(r);
    const producer = r.winery || r.grapeProducer || '—';
    const colorBadge = buildColorBadge(r.color);
    const alcoholVal = r.alcohol != null ? r.alcohol + ' %' : '<span class="nd">н/д</span>';

    return `<tr>
      <td class="td-idx">${idx}</td>
      <td class="td-date">${e(r.researchDate) || '—'}</td>
      <td class="td-region">${e(region)}</td>
      <td class="td-producer">${e(producer)}</td>
      <td class="td-color">${colorBadge}</td>
      <td class="td-sort">${e(r.sort) || '—'}</td>
      <td class="td-year">${r.year ?? '—'}</td>
      <td class="td-alcohol">${alcoholVal}</td>
      <td class="td-extra">
        <button class="btn-extra" data-idx="${start + i}" title="Подробный аналитический блок" aria-label="Подробнее">
          <span class="btn-extra-desktop">Доп.</span>
          <span class="btn-extra-mobile" aria-hidden="true">ℹ️</span>
        </button>
      </td>
    </tr>`;
  }).join('');

  // Bind "Доп." buttons
  tbody.querySelectorAll('.btn-extra').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = state.filtered[Number(btn.dataset.idx)];
      openModal(row);
    });
  });
}

function buildRegion(r) {
  const parts = [
    r.district || r.adminRegion,
    r.climateZone,
    r.location,
  ].filter(Boolean);
  return parts.join(', ') || '—';
}

function buildColorBadge(color) {
  if (!color) return '<span class="nd">—</span>';
  const cls = color.includes('бел') ? 'badge-white'
            : color.includes('крас') ? 'badge-red'
            : color.includes('роз')  ? 'badge-rose'
            : 'badge-other';
  return `<span class="color-badge ${cls}">${e(color)}</span>`;
}

/* ════════════════════════════════════════════════════ */
/*  PAGINATION                                          */
/* ════════════════════════════════════════════════════ */
function renderPagination() {
  const pg    = document.getElementById('pagination');
  if (!pg) return;
  const total = Math.ceil(state.filtered.length / PAGE_SIZE);
  if (total <= 1) { pg.innerHTML = ''; return; }

  let html = `<button class="pg-btn" ${state.page===1?'disabled':''} data-p="${state.page-1}">‹</button>`;
  pagesToShow(state.page, total).forEach((p, i, arr) => {
    if (i > 0 && p - arr[i-1] > 1) html += `<span class="pg-ellipsis">…</span>`;
    html += `<button class="pg-btn${p===state.page?' pg-active':''}" data-p="${p}">${p}</button>`;
  });
  html += `<button class="pg-btn" ${state.page===total?'disabled':''} data-p="${state.page+1}">›</button>`;
  html += `<span class="pg-info">${state.page} / ${total} · всего ${state.filtered.length}</span>`;
  pg.innerHTML = html;

  pg.querySelectorAll('.pg-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = Number(btn.dataset.p);
      renderTable();
      renderPagination();
      document.getElementById('tableWrap')?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

function pagesToShow(cur, total) {
  const delta = 2, r = [];
  for (let i = Math.max(1, cur-delta); i <= Math.min(total, cur+delta); i++) r.push(i);
  if (!r.includes(1)) r.unshift(1);
  if (!r.includes(total)) r.push(total);
  return r;
}

/* ════════════════════════════════════════════════════ */
/*  MODAL                                               */
/* ════════════════════════════════════════════════════ */
function openModal(row) {
  const overlay = document.getElementById('analyticsOverlay');
  if (!overlay) return;
  state.activeModal = overlay;

  // Header info
  document.getElementById('modalSampleName').textContent =
    row.name || row.sort || `Образец ${row._row || ''}`;

  const meta = [
    row.sort        ? `Сорт: <strong>${e(row.sort)}</strong>` : '',
    row.year        ? `Год: <strong>${row.year}</strong>`     : '',
    row.color       ? `Цвет: <strong>${e(row.color)}</strong>`: '',
    row.productType ? `<strong>${e(row.productType)}</strong>` : '',
  ].filter(Boolean).join(' · ');
  document.getElementById('modalMeta').innerHTML = meta;

  // Org info
  const orgParts = [
    row.district    ? `<strong>Район (СРО):</strong> ${e(row.district)}` : '',
    row.adminRegion ? `<strong>Адм. район:</strong> ${e(row.adminRegion)}` : '',
    row.climateZone ? `<strong>Климатич. зона:</strong> ${e(row.climateZone)}` : '',
    row.location    ? `<strong>Нас. пункт:</strong> ${e(row.location)}` : '',
    row.grapeProducer ? `<strong>Производитель винограда:</strong> ${e(row.grapeProducer)}` : '',
    row.winery      ? `<strong>Винодельня:</strong> ${e(row.winery)}` : '',
    row.researchDate? `<strong>Дата исследования:</strong> ${e(row.researchDate)}` : '',
  ].filter(Boolean);
  document.getElementById('modalOrgInfo').innerHTML = orgParts.length
    ? orgParts.map(p => `<div class="modal-info-row">${p}</div>`).join('')
    : '<div class="modal-info-row nd">Нет данных</div>';

  // GOST block
  document.getElementById('modalGost').innerHTML = renderFieldGroup(row, GOST_FIELDS);

  // Extra block
  document.getElementById('modalExtra').innerHTML = renderFieldGroup(row, EXTRA_FIELDS);

  overlay.classList.add('open');
  document.body.classList.add('modal-open');
  overlay.querySelector('.modal-close')?.focus();
}

function renderFieldGroup(row, fields) {
  return fields.map(f => {
    const v = row[f.key];
    const empty = v === null || v === undefined;
    const valStr = empty
      ? '<span class="nd">н/д</span>'
      : `<strong>${e(String(v))}</strong>${f.unit ? ` <span class="unit">${e(f.unit)}</span>` : ''}`;
    return `<div class="analytic-row${empty?' analytic-nd':''}">
      <span class="analytic-label">${e(f.label)}</span>
      <span class="analytic-val">${valStr}</span>
    </div>`;
  }).join('');
}

function closeModal() {
  if (state.activeModal) {
    state.activeModal.classList.remove('open');
    state.activeModal = null;
  }
  document.body.classList.remove('modal-open');
}

/* ════════════════════════════════════════════════════ */
/*  UI HELPERS                                          */
/* ════════════════════════════════════════════════════ */
function showLoader(on) {
  const el = document.getElementById('tableLoader');
  if (el) el.style.display = on ? 'flex' : 'none';
  const tw = document.getElementById('tableWrap');
  if (tw) tw.style.display = on ? 'none' : '';
}

function showError(msg) {
  const el = document.getElementById('tableError');
  if (el) { el.textContent = '⚠️ ' + msg; el.style.display = 'block'; }
}

function e(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); };
}

/* ════════════════════════════════════════════════════ */
/*  BIND EVENTS                                         */
/* ════════════════════════════════════════════════════ */
function bindEvents() {
  // Search
  document.getElementById('searchInput')?.addEventListener('input', debounce(applyFilters, 220));

  // Filter selects
  ['filterYear','filterColor','filterRegion'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', applyFilters));

  // Reset
  document.getElementById('btnResetFilters')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    ['filterYear','filterColor','filterRegion'].forEach(id => {
      const s = document.getElementById(id);
      if (s) s.value = '';
    });
    applyFilters();
  });

  // Column sort
  document.querySelectorAll('#wineTable thead th[data-col]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => applySort(th.dataset.col));
  });

  // Modal close
  const overlay = document.getElementById('analyticsOverlay');
  if (overlay) {
    overlay.querySelector('.modal-close')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) closeModal(); });
  }
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });
}

/* ── Start ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  boot();
});
