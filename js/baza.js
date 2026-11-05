/* =====================================================
   WINE CATALOG — БАЗА ОБРАЗЦОВ
   baza.js — filters · table · pagination · modal
   (только чтение; редактирование данных — через /admin/, фаза 5)
   ===================================================== */
'use strict';

/* ── Pagination ─────────────────────────────────────── */
const PER_PAGE = 25;

/* ── Field definitions ──────────────────────────────── */
const ORG_FIELDS = [
  { key:'wineDistrict',   label:'Виноградо-вин. район (СРО)' },
  { key:'climateZone',    label:'Природно-климатич. зона' },
  { key:'climateRegion',  label:'Природно-климатич. район' },
  { key:'adminRegion',    label:'Административный район' },
  { key:'location',       label:'Населённый пункт' },
  { key:'grapeProducer',  label:'Производитель винограда' },
  { key:'winery',         label:'Производитель вина (винодельня)' },
  { key:'researchDate',   label:'Дата исследования' },
];

const TECH_FIELDS = [
  { key:'name',        label:'Наименование образца' },
  { key:'sort',        label:'Сортовой состав' },
  { key:'harvestYear', label:'Год урожая' },
  { key:'color',       label:'Цвет' },
  { key:'productType', label:'Тип продукции' },
];

const ANALYTIC_FIELDS = [
  { key:'alcohol',             label:'Объёмная доля этил. спирта',  unit:'% об.' },
  { key:'reducedExtract',      label:'Приведённый экстракт',         unit:'г/дм³' },
  { key:'titratedAcidity',     label:'Титруемая кислотность',        unit:'г/дм³' },
  { key:'sugar',               label:'Сахара',                       unit:'г/дм³' },
  { key:'citricAcid',          label:'Лимонная кислота',             unit:'г/дм³' },
  { key:'tartaricAcid',        label:'Винная кислота',               unit:'г/дм³' },
  { key:'malicAcid',           label:'Яблочная кислота',             unit:'г/дм³' },
  { key:'succinicAcid',        label:'Янтарная кислота',             unit:'г/дм³' },
  { key:'lacticAcid',          label:'Молочная кислота',             unit:'г/дм³' },
  { key:'aceticAcid',          label:'Уксусная кислота',             unit:'г/дм³' },
  { key:'bioses',              label:'Биозы (пересч. на сахарозу)',  unit:'г/дм³' },
  { key:'glucose',             label:'Глюкоза',                      unit:'г/дм³' },
  { key:'fructose',            label:'Фруктоза',                     unit:'г/дм³' },
  { key:'glycerin',            label:'Глицерин',                     unit:'г/дм³' },
  { key:'chlorides',           label:'Хлориды',                      unit:'мг/дм³' },
  { key:'sodium',              label:'Натрий',                       unit:'мг/дм³' },
  { key:'potassium',           label:'Калий',                        unit:'мг/дм³' },
  { key:'magnesium',           label:'Магний',                       unit:'мг/дм³' },
  { key:'calcium',             label:'Кальций',                      unit:'мг/дм³' },
  { key:'phenolicSubstances',  label:'Сумма фенольных веществ',      unit:'мг/дм³' },
  { key:'ph',                  label:'pH',                           unit:'' },
  { key:'bufferCapacity',      label:'Буферная ёмкость (щелочью)',   unit:'ммоль/дм³' },
  { key:'electricConductivity',label:'Электропроводность',           unit:'мСм/см' },
];

/* ── State ──────────────────────────────────────────── */
const state = {
  all:       [],   // from data.js
  filtered:  [],
  sortCol:   'id',
  sortDir:   'asc',
  page:      1,
};

/* ════════════════════════════════════════════════════ */
/*  INIT                                                */
/* ════════════════════════════════════════════════════ */
function init() {
  state.all = Array.isArray(window.wineSamples) ? window.wineSamples : [];

  populateFilters();
  applyUrlParams();
  bindEvents();
  applyFiltersAndRender();
}

/* ════════════════════════════════════════════════════ */
/*  FILTERS                                             */
/* ════════════════════════════════════════════════════ */
function populateFilters() {
  const regions   = new Set();
  const sorts     = new Set();
  const years     = new Set();
  const producers = new Set();

  state.all.forEach(s => {
    if (s.adminRegion)   regions.add(s.adminRegion);
    if (s.sort)          sorts.add(s.sort);
    if (s.harvestYear)   years.add(s.harvestYear);
    if (s.grapeProducer) producers.add(s.grapeProducer);
    if (s.winery)        producers.add(s.winery);
  });

  fillSelect('filterRegion',   [...regions].sort());
  fillSelect('filterSort',     [...sorts].sort());
  fillSelect('filterYear',     [...years].sort((a,b) => b - a));
  fillSelect('filterProducer', [...producers].sort());
}

function fillSelect(id, vals) {
  const sel = document.getElementById(id);
  // clear dynamic options (keep first "all" option)
  while (sel.options.length > 1) sel.remove(1);
  vals.forEach(v => {
    const o = document.createElement('option');
    o.value = o.textContent = v;
    sel.appendChild(o);
  });
}

function applyUrlParams() {
  const p = new URLSearchParams(window.location.search);
  ['year','color','region'].forEach(k => {
    const v = p.get(k);
    if (!v) return;
    const map = { year:'filterYear', color:'filterColor', region:'filterRegion' };
    const sel = document.getElementById(map[k]);
    if (sel && [...sel.options].some(o => o.value === v)) sel.value = v;
  });
}

/* ════════════════════════════════════════════════════ */
/*  APPLY FILTERS + RENDER                              */
/* ════════════════════════════════════════════════════ */
function applyFiltersAndRender() {
  const q        = (document.getElementById('globalSearch').value || '').toLowerCase().trim();
  const region   = document.getElementById('filterRegion').value;
  const sort     = document.getElementById('filterSort').value;
  const year     = document.getElementById('filterYear').value;
  const color    = document.getElementById('filterColor').value;
  const producer = document.getElementById('filterProducer').value;

  state.filtered = state.all.filter(s => {
    if (region   && s.adminRegion !== region)                     return false;
    if (sort     && s.sort        !== sort)                       return false;
    if (year     && String(s.harvestYear) !== String(year))       return false;
    if (color    && s.color       !== color)                      return false;
    if (producer && s.grapeProducer !== producer && s.winery !== producer) return false;
    if (q) {
      const hay = [s.name, s.sort, s.adminRegion, s.wineDistrict,
                   s.location, s.grapeProducer, s.winery, s.color,
                   s.harvestYear, s.productType]
        .map(v => String(v ?? '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  state.page = 1;
  renderTable();
  renderPagination();
  document.getElementById('resultCount').textContent = state.filtered.length;
}

/* ════════════════════════════════════════════════════ */
/*  SORT + RENDER TABLE                                 */
/* ════════════════════════════════════════════════════ */
function sortedFiltered() {
  const col = state.sortCol, dir = state.sortDir;
  return [...state.filtered].sort((a, b) => {
    let av = a[col] ?? '', bv = b[col] ?? '';
    if (typeof av === 'number' && typeof bv === 'number')
      return dir === 'asc' ? av - bv : bv - av;
    av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
    return dir === 'asc' ? av.localeCompare(bv,'ru') : bv.localeCompare(av,'ru');
  });
}

function renderTable() {
  const sorted = sortedFiltered();
  const start  = (state.page - 1) * PER_PAGE;
  const page   = sorted.slice(start, start + PER_PAGE);
  const tbody  = document.getElementById('tableBody');
  const empty  = document.getElementById('emptyState');

  if (!page.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = page.map(s => `
    <tr data-id="${s.id}" tabindex="0">
      <td class="row-id">${s.id}</td>
      <td>${esc(s.name || s.sort || '—')}</td>
      <td>${esc(s.sort || '—')}</td>
      <td>${s.harvestYear ?? '—'}</td>
      <td><span class="badge ${colorBadge(s.color)}">${esc(s.color || '—')}</span></td>
      <td>${esc(s.adminRegion || '—')}</td>
      <td>${esc(s.wineDistrict || '—')}</td>
      <td>${fmt(s.ph)}</td>
      <td>${fmt(s.alcohol) !== '—' ? fmt(s.alcohol) + '%' : '—'}</td>
      <td>${fmt(s.titratedAcidity)}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click',   () => openDetailModal(Number(tr.dataset.id)));
    tr.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') openDetailModal(Number(tr.dataset.id)); });
  });
}

/* ════════════════════════════════════════════════════ */
/*  PAGINATION                                          */
/* ════════════════════════════════════════════════════ */
function renderPagination() {
  const total = Math.ceil(state.filtered.length / PER_PAGE);
  const pg    = document.getElementById('pagination');
  if (total <= 1) { pg.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${state.page===1?'disabled':''} data-pg="${state.page-1}">‹</button>`;
  let prev = 0;
  pagesToShow(state.page, total).forEach(p => {
    if (p - prev > 1) html += `<span class="page-info">…</span>`;
    html += `<button class="page-btn${p===state.page?' active':''}" data-pg="${p}">${p}</button>`;
    prev = p;
  });
  html += `<button class="page-btn" ${state.page===total?'disabled':''} data-pg="${state.page+1}">›</button>`;
  html += `<span class="page-info">${state.page} / ${total}</span>`;
  pg.innerHTML = html;

  pg.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = Number(btn.dataset.pg);
      renderTable();
      renderPagination();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function pagesToShow(cur, total) {
  const d = 2, r = [];
  for (let i = Math.max(1,cur-d); i <= Math.min(total,cur+d); i++) r.push(i);
  if (!r.includes(1)) r.unshift(1);
  if (!r.includes(total)) r.push(total);
  return r;
}

/* ════════════════════════════════════════════════════ */
/*  DETAIL MODAL                                        */
/* ════════════════════════════════════════════════════ */
function openDetailModal(id) {
  const s = state.all.find(x => x.id === id);
  if (!s) return;

  document.getElementById('modalTitle').textContent = s.name || s.sort || `Образец #${s.id}`;

  document.getElementById('modalMeta').innerHTML = [
    s.sort        ? `<span class="modal-meta-badge">${esc(s.sort)}</span>` : '',
    s.harvestYear ? `<span class="modal-meta-badge">Урожай ${s.harvestYear}</span>` : '',
    s.color       ? `<span class="modal-meta-badge">${esc(s.color)}</span>` : '',
    s.productType ? `<span class="modal-meta-badge">${esc(s.productType)}</span>` : '',
  ].join('');

  document.getElementById('modalOrgBlock').innerHTML       = renderFields(s, ORG_FIELDS);
  document.getElementById('modalTechBlock').innerHTML      = renderFields(s, TECH_FIELDS);
  document.getElementById('modalAnalyticBlock').innerHTML  = renderAnalytic(s);

  openOverlay('modalOverlay');
}

function renderFields(s, fields) {
  return fields.map(f => {
    const v = s[f.key];
    const empty = v === null || v === undefined || v === '';
    return `<div class="modal-field">
      <div class="modal-field-label">${esc(f.label)}</div>
      <div class="modal-field-value${empty?' null-val':''}">${empty ? 'н/д' : esc(String(v))}</div>
    </div>`;
  }).join('');
}

function renderAnalytic(s) {
  return ANALYTIC_FIELDS
    .filter(f => f.key in s)
    .map(f => {
      const v = s[f.key];
      const empty = v === null || v === undefined;
      return `<div class="modal-field">
        <div class="modal-field-label">${esc(f.label)}</div>
        <div class="modal-field-value${empty?' null-val':''}">
          ${empty ? 'н/д' : esc(String(v))}${!empty && f.unit ? `<span class="modal-field-unit">&nbsp;${esc(f.unit)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
}

/* ════════════════════════════════════════════════════ */
/*  OVERLAY HELPERS                                     */
/* ════════════════════════════════════════════════════ */
function openOverlay(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}
function bindClose(overlayId, closeBtnId) {
  const overlay = document.getElementById(overlayId);
  document.getElementById(closeBtnId).addEventListener('click', () => closeOverlay(overlayId));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(overlayId); });
}

/* ════════════════════════════════════════════════════ */
/*  SORT INDICATORS                                     */
/* ════════════════════════════════════════════════════ */
function updateSortIndicators() {
  document.querySelectorAll('#samplesTable thead th').forEach(th => {
    th.classList.remove('sorted-asc','sorted-desc');
    if (th.getAttribute('data-col') === state.sortCol)
      th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
  });
}

/* ════════════════════════════════════════════════════ */
/*  BIND ALL EVENTS                                     */
/* ════════════════════════════════════════════════════ */
function bindEvents() {
  // Search + filters
  document.getElementById('globalSearch').addEventListener('input', debounce(applyFiltersAndRender, 220));
  ['filterRegion','filterSort','filterYear','filterColor','filterProducer'].forEach(id =>
    document.getElementById(id).addEventListener('change', applyFiltersAndRender));
  document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('globalSearch').value = '';
    ['filterRegion','filterSort','filterYear','filterColor','filterProducer']
      .forEach(id => { document.getElementById(id).value = ''; });
    applyFiltersAndRender();
  });

  // Column sort
  document.querySelectorAll('#samplesTable thead th[data-col]:not(.no-sort)').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      state.sortDir = state.sortCol === col ? (state.sortDir==='asc'?'desc':'asc') : 'asc';
      state.sortCol = col;
      updateSortIndicators();
      renderTable();
    });
  });

  // Modals: detail
  bindClose('modalOverlay', 'modalClose');

  // Global Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modalOverlay').classList.contains('open')) closeOverlay('modalOverlay');
  });
}

/* ════════════════════════════════════════════════════ */
/*  UTILITIES                                           */
/* ════════════════════════════════════════════════════ */
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  return esc(String(v));
}

function colorBadge(c) {
  if (!c) return '';
  const l = c.toLowerCase();
  if (l.includes('бел')) return 'badge-white';
  if (l.includes('крас')) return 'badge-red';
  if (l.includes('роз')) return 'badge-rose';
  return '';
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ── Start ─────────────────────────────────────────── */
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', init);
else
  init();
