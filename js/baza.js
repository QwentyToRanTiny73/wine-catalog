/* =====================================================
   WINE CATALOG — БАЗА ОБРАЗЦОВ
   baza.js — filters · table · pagination · modal
             admin login · manual entry · excel upload
   ===================================================== */
'use strict';

/* ── Credentials (client-side, as requested) ───────── */
const ADMIN_LOGIN    = 'MagarachDB';
const ADMIN_PASSWORD = 'Ximxim26';
const LS_AUTH_KEY    = 'mgr_admin_auth';
const LS_EXTRA_KEY   = 'mgr_extra_samples';   // locally added samples
const LS_IMPORTED_KEY= 'mgr_imported_samples'; // excel-imported samples

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

/* Excel column → JS field mapping for upload */
const EXCEL_COL_MAP = {
  'номер':'id','дата исследования':'researchDate',
  'виноградо-винодельческий район по сро':'wineDistrict',
  'природно-климатическая зона выращивания винограда':'climateZone',
  'природно-климатический район выращивания винограда':'climateRegion',
  'административный район выращивания винграда':'adminRegion',
  'место расположение виноградника (населенный пункт)':'location',
  'производитель винограда (хозяйство)':'grapeProducer',
  'производитель вина (винодельня)':'winery',
  'тип винодельческой продукции':'productType',
  'наименование образца':'name',
  'сортовой состав':'sort',
  'год урожая':'harvestYear',
  'цвет':'color',
  'объемная доля этилового спирта':'alcohol',
  'приведенный экстракт':'reducedExtract',
  'титруемая кислотность':'titratedAcidity',
  'сахара':'sugar',
  'лимонная кислота':'citricAcid',
  'винная кислота':'tartaricAcid',
  'яблочная кислота':'malicAcid',
  'янтарная кислота':'succinicAcid',
  'молочная кислота':'lacticAcid',
  'уксусная кислота':'aceticAcid',
  'биозы  (в пересчете на сахарозу)':'bioses',
  'глюкоза':'glucose',
  'фруктоза':'fructose',
  'глицерин':'glycerin',
  'хлориды':'chlorides',
  'натрий':'sodium',
  'калий':'potassium',
  'магний':'magnesium',
  'кальций':'calcium',
  'сумма фенольных веществ':'phenolicSubstances',
  'рн':'ph','ph':'ph',
  'буферная емкость щелочью':'bufferCapacity',
  'электропроводность':'electricConductivity',
};

const COLOR_MAP   = {'б':'белое','к':'красное','р':'розовое'};
const TYPE_MAP    = {'в':'вино','вм':'виноматериал'};
const STR_KEYS    = new Set(['researchDate','wineDistrict','climateZone','climateRegion',
  'adminRegion','location','grapeProducer','winery','productType','name','sort','color']);

/* ── State ──────────────────────────────────────────── */
const state = {
  base:      [],   // from data.js
  extra:     [],   // added manually / imported
  all:       [],   // base + extra combined
  filtered:  [],
  sortCol:   'id',
  sortDir:   'asc',
  page:      1,
  isAdmin:   false,
  pendingImport: [], // rows parsed from excel, awaiting confirm
};

/* ════════════════════════════════════════════════════ */
/*  INIT                                                */
/* ════════════════════════════════════════════════════ */
function init() {
  state.base  = Array.isArray(window.wineSamples) ? window.wineSamples : [];
  state.extra = loadExtra();
  rebuildAll();

  populateFilters();
  applyUrlParams();
  buildAddForm();
  bindEvents();
  checkAdminSession();
  applyFiltersAndRender();
}

function rebuildAll() {
  state.all = [...state.base, ...state.extra];
}

/* ── Load/save extra samples from localStorage ──────── */
function loadExtra() {
  try {
    const raw = localStorage.getItem(LS_EXTRA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveExtra() {
  localStorage.setItem(LS_EXTRA_KEY, JSON.stringify(state.extra));
}

function nextId() {
  const max = state.all.reduce((m, s) => Math.max(m, s.id || 0), 0);
  return max + 1;
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
/*  ADMIN AUTH                                          */
/* ════════════════════════════════════════════════════ */
function checkAdminSession() {
  state.isAdmin = localStorage.getItem(LS_AUTH_KEY) === '1';
  setAdminUI(state.isAdmin);
}

function setAdminUI(on) {
  document.getElementById('adminBar').style.display = on ? 'flex' : 'none';
}

function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  if (u === ADMIN_LOGIN && p === ADMIN_PASSWORD) {
    localStorage.setItem(LS_AUTH_KEY, '1');
    state.isAdmin = true;
    setAdminUI(true);
    closeOverlay('loginOverlay');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    err.style.display = 'none';
  } else {
    err.style.display = 'block';
  }
}

function doLogout() {
  localStorage.removeItem(LS_AUTH_KEY);
  state.isAdmin = false;
  setAdminUI(false);
}

/* ════════════════════════════════════════════════════ */
/*  ADD SAMPLE FORM                                     */
/* ════════════════════════════════════════════════════ */
function buildAddForm() {
  const container = document.getElementById('addAnalyticFields');
  if (!container) return;
  container.innerHTML = ANALYTIC_FIELDS.map(f => `
    <div class="form-field">
      <label>${esc(f.label)}${f.unit ? ` <span class="modal-field-unit">${esc(f.unit)}</span>` : ''}</label>
      <input name="${f.key}" type="number" step="any" class="search-input" />
    </div>
  `).join('');
}

function collectFormData(form) {
  const fd = new FormData(form);
  const rec = { id: nextId(), _source: 'manual' };
  for (const [key, val] of fd.entries()) {
    if (!val.trim()) { rec[key] = null; continue; }
    if (key === 'harvestYear') rec[key] = parseInt(val, 10);
    else if (STR_KEYS.has(key)) rec[key] = val.trim();
    else { const n = parseFloat(val); rec[key] = isNaN(n) ? null : n; }
  }
  return rec;
}

function submitAddSample(e) {
  e.preventDefault();
  if (!state.isAdmin) return;
  const rec = collectFormData(e.target);
  state.extra.push(rec);
  saveExtra();
  rebuildAll();
  populateFilters();
  applyFiltersAndRender();
  closeOverlay('addSampleOverlay');
  e.target.reset();
  showToast(`✅ Образец «${rec.name || rec.sort || '#'+rec.id}» добавлен`);
}

/* ════════════════════════════════════════════════════ */
/*  EXCEL UPLOAD                                        */
/* ════════════════════════════════════════════════════ */
function handleExcelFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
      const parsed = parseExcelRows(raw);
      if (!parsed.length) {
        showUploadStatus('Не найдено строк с данными. Проверьте формат файла.', true);
        return;
      }
      state.pendingImport = parsed;
      showUploadPreview(parsed);
    } catch (err) {
      showUploadStatus('Ошибка чтения файла: ' + err.message, true);
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseExcelRows(rows) {
  const results = [];
  let baseId = nextId();

  rows.forEach(row => {
    // Normalise keys: lower-case, trim
    const normRow = {};
    Object.entries(row).forEach(([k, v]) => {
      normRow[k.toLowerCase().trim()] = v;
    });

    const rec = { id: baseId++, _source: 'excel' };

    // Try to map columns by name
    Object.entries(EXCEL_COL_MAP).forEach(([excelKey, jsKey]) => {
      if (excelKey in normRow) {
        const val = normRow[excelKey];
        rec[jsKey] = coerceVal(jsKey, val);
      }
    });

    // Skip rows that have no meaningful data
    if (!rec.sort && !rec.name && !rec.harvestYear) return;
    // Normalise color shortcuts
    if (rec.color) {
      const c = String(rec.color).toLowerCase().trim();
      rec.color = COLOR_MAP[c] || c;
    }
    if (rec.productType) {
      const t = String(rec.productType).toLowerCase().trim();
      rec.productType = TYPE_MAP[t] || t;
    }

    results.push(rec);
  });
  return results;
}

function coerceVal(key, val) {
  if (val === null || val === '' || val === undefined) return null;
  if (key === 'id') return parseInt(val, 10) || null;
  if (key === 'harvestYear') return parseInt(val, 10) || null;
  if (STR_KEYS.has(key)) return String(val).trim() || null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

function showUploadStatus(msg, isError) {
  const el = document.getElementById('uploadStatus');
  const txt = document.getElementById('uploadStatusText');
  el.style.display = 'block';
  txt.textContent = msg;
  txt.style.color = isError ? '#c0392b' : '#27ae60';
}

function showUploadPreview(parsed) {
  document.getElementById('uploadPreview').style.display = 'block';
  document.getElementById('uploadPreviewCount').textContent = parsed.length;
  document.getElementById('uploadPreviewList').innerHTML = parsed.map(s =>
    `<div style="padding:4px 0;border-bottom:1px solid #E0CEBB;">
      <strong>${esc(s.name || s.sort || '—')}</strong>
      ${s.sort ? ' · ' + esc(s.sort) : ''}
      ${s.harvestYear ? ' · ' + s.harvestYear : ''}
      ${s.color ? ' · ' + esc(s.color) : ''}
    </div>`
  ).join('');
}

function confirmImport() {
  if (!state.pendingImport.length) return;
  // Re-assign IDs to avoid conflicts
  let baseId = nextId();
  state.pendingImport.forEach(r => { r.id = baseId++; });
  state.extra.push(...state.pendingImport);
  saveExtra();
  rebuildAll();
  populateFilters();
  applyFiltersAndRender();
  const count = state.pendingImport.length;
  state.pendingImport = [];
  closeOverlay('excelUploadOverlay');
  resetUploadUI();
  showToast(`✅ Импортировано ${count} образцов из Excel`);
}

function resetUploadUI() {
  document.getElementById('uploadStatus').style.display = 'none';
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadPreviewList').innerHTML = '';
  document.getElementById('excelUploadInput').value = '';
}

/* ════════════════════════════════════════════════════ */
/*  DRAG & DROP for upload zone                         */
/* ════════════════════════════════════════════════════ */
function bindDropZone() {
  const zone  = document.getElementById('uploadZone');
  const input = document.getElementById('excelUploadInput');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleExcelFile(f);
  });

  document.getElementById('uploadZoneClick').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) handleExcelFile(input.files[0]); });
}

/* ════════════════════════════════════════════════════ */
/*  TOAST NOTIFICATION                                  */
/* ════════════════════════════════════════════════════ */
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('toast-show');
  setTimeout(() => t.classList.remove('toast-show'), 3200);
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

  // Admin: nav icon
  document.getElementById('navAdminBtn').addEventListener('click', e => {
    e.preventDefault();
    if (state.isAdmin) doLogout();
    else openOverlay('loginOverlay');
  });

  // Admin: login form
  bindClose('loginOverlay', 'loginClose');
  document.getElementById('loginSubmit').addEventListener('click', doLogin);
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });

  // Admin: logout
  document.getElementById('btnLogout').addEventListener('click', doLogout);

  // Admin: add sample
  document.getElementById('btnAddSample').addEventListener('click', () => openOverlay('addSampleOverlay'));
  bindClose('addSampleOverlay', 'addSampleClose');
  document.getElementById('addSampleCancel').addEventListener('click', () => closeOverlay('addSampleOverlay'));
  document.getElementById('addSampleForm').addEventListener('submit', submitAddSample);

  // Admin: Excel upload button
  document.getElementById('btnUploadExcel').addEventListener('click', () => {
    resetUploadUI();
    openOverlay('excelUploadOverlay');
  });
  bindClose('excelUploadOverlay', 'excelUploadClose');
  document.getElementById('uploadCancel').addEventListener('click', () => {
    state.pendingImport = [];
    resetUploadUI();
    closeOverlay('excelUploadOverlay');
  });
  document.getElementById('uploadConfirm').addEventListener('click', confirmImport);

  bindDropZone();

  // Global Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['modalOverlay','loginOverlay','addSampleOverlay','excelUploadOverlay'].forEach(id => {
      if (document.getElementById(id).classList.contains('open')) closeOverlay(id);
    });
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
