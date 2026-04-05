/**
 * table.js — Таблица образцов вина (Магарач)
 * Данные: window.wineSamples из js/data.js (133 записи)
 * Без fetch, без Excel — работает мгновенно
 */
'use strict';

/* ── Config ─────────────────────────────────────── */
const PER_PAGE = 30;

/* ── Field definitions ───────────────────────────── */
const ORG_FIELDS = [
  { k:'wineDistrict',   l:'Виноградо-вин. район (СРО)' },
  { k:'climateZone',    l:'Климатич. зона' },
  { k:'climateRegion',  l:'Климатич. район' },
  { k:'adminRegion',    l:'Административный район' },
  { k:'location',       l:'Населённый пункт' },
  { k:'grapeProducer',  l:'Производитель винограда' },
  { k:'winery',         l:'Производитель вина / Винодельня' },
  { k:'researchDate',   l:'Дата исследования' },
  { k:'productType',    l:'Тип продукции' },
];

const GOST_FIELDS = [
  { k:'alcohol',          l:'Объёмная доля этил. спирта',  u:'% об.' },
  { k:'reducedExtract',   l:'Приведённый экстракт',        u:'г/дм³' },
  { k:'titratedAcidity',  l:'Титруемая кислотность',       u:'г/дм³' },
  { k:'sugar',            l:'Сахара',                      u:'г/дм³' },
];

const EXTRA_FIELDS = [
  { k:'citricAcid',          l:'Лимонная кислота',           u:'г/дм³' },
  { k:'tartaricAcid',        l:'Винная кислота',             u:'г/дм³' },
  { k:'malicAcid',           l:'Яблочная кислота',           u:'г/дм³' },
  { k:'succinicAcid',        l:'Янтарная кислота',           u:'г/дм³' },
  { k:'lacticAcid',          l:'Молочная кислота',           u:'г/дм³' },
  { k:'aceticAcid',          l:'Уксусная кислота',           u:'г/дм³' },
  { k:'bioses',              l:'Биозы (на сахарозу)',        u:'г/дм³' },
  { k:'glucose',             l:'Глюкоза',                    u:'г/дм³' },
  { k:'fructose',            l:'Фруктоза',                   u:'г/дм³' },
  { k:'glycerin',            l:'Глицерин',                   u:'г/дм³' },
  { k:'chlorides',           l:'Хлориды',                    u:'мг/дм³' },
  { k:'sodium',              l:'Натрий',                     u:'мг/дм³' },
  { k:'potassium',           l:'Калий',                      u:'мг/дм³' },
  { k:'magnesium',           l:'Магний',                     u:'мг/дм³' },
  { k:'calcium',             l:'Кальций',                    u:'мг/дм³' },
  { k:'phenolicSubstances',  l:'Σ Фенольных веществ',       u:'мг/дм³' },
  { k:'ph',                  l:'pH',                         u:'' },
  { k:'bufferCapacity',      l:'Буферная ёмкость (щелочью)', u:'ммоль/дм³' },
  { k:'electricConductivity',l:'Электропроводность',         u:'мСм/см' },
];

/* ── State ───────────────────────────────────────── */
const S = {
  all:      [],
  filtered: [],
  page:     1,
  sortCol:  null,
  sortDir:  'asc',
};

/* ════════════════════════════════════════════════ */
/*  INIT                                            */
/* ════════════════════════════════════════════════ */
function init() {
  const loader = document.getElementById('tableLoader');
  const wrap   = document.getElementById('tableWrap');
  const errBox = document.getElementById('tableError');

  // Hide loader
  if (loader) loader.style.display = 'none';

  if (!Array.isArray(window.wineSamples) || !window.wineSamples.length) {
    if (errBox) {
      errBox.textContent = '⚠️ Данные не загружены. Убедитесь что файл js/data.js подключён.';
      errBox.style.display = 'block';
    }
    return;
  }

  S.all      = window.wineSamples;
  S.filtered = [...S.all];

  if (wrap) wrap.style.display = '';

  populateFilters();
  render();
  updateCount();
}

/* ════════════════════════════════════════════════ */
/*  FILTERS                                         */
/* ════════════════════════════════════════════════ */
function populateFilters() {
  const years   = [...new Set(S.all.map(r => r.harvestYear).filter(Boolean))].sort((a,b)=>b-a);
  const colors  = [...new Set(S.all.map(r => r.color).filter(Boolean))].sort();
  const regions = [...new Set(S.all.map(r => r.adminRegion || r.wineDistrict).filter(Boolean))].sort();

  addOpts('filterYear',   years);
  addOpts('filterColor',  colors);
  addOpts('filterRegion', regions);
}

function addOpts(id, vals) {
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
  const q      = (val('searchInput') || '').toLowerCase().trim();
  const year   = val('filterYear')   || '';
  const color  = val('filterColor')  || '';
  const region = val('filterRegion') || '';

  S.filtered = S.all.filter(r => {
    if (year   && String(r.harvestYear||'') !== year)                    return false;
    if (color  && (r.color||'')             !== color)                   return false;
    if (region && (r.adminRegion||r.wineDistrict||'') !== region)        return false;
    if (q) {
      const hay = [r.name, r.sort, r.color, r.wineDistrict, r.adminRegion,
                   r.location, r.grapeProducer, r.winery, r.harvestYear]
        .map(v => String(v||'').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  S.page = 1;
  render();
  updateCount();
}

function val(id) {
  return document.getElementById(id)?.value || '';
}

/* ════════════════════════════════════════════════ */
/*  SORT                                            */
/* ════════════════════════════════════════════════ */
function sortBy(col) {
  S.sortDir = S.sortCol === col ? (S.sortDir==='asc'?'desc':'asc') : 'asc';
  S.sortCol = col;

  document.querySelectorAll('#wineTable thead th[data-col]').forEach(th => {
    th.classList.remove('th-asc','th-desc');
    if (th.dataset.col === col)
      th.classList.add(S.sortDir === 'asc' ? 'th-asc' : 'th-desc');
  });

  S.filtered.sort((a,b) => {
    let av = a[col]??'', bv = b[col]??'';
    if (typeof av==='number'&&typeof bv==='number')
      return S.sortDir==='asc' ? av-bv : bv-av;
    av=String(av).toLowerCase(); bv=String(bv).toLowerCase();
    return S.sortDir==='asc' ? av.localeCompare(bv,'ru') : bv.localeCompare(av,'ru');
  });
  render();
}

/* ════════════════════════════════════════════════ */
/*  RENDER TABLE                                    */
/* ════════════════════════════════════════════════ */
function render() {
  const tbody = document.getElementById('wineTableBody');
  if (!tbody) return;

  const start = (S.page - 1) * PER_PAGE;
  const rows  = S.filtered.slice(start, start + PER_PAGE);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">🔍 Ничего не найдено</td></tr>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = rows.map((r, i) => {
    const region = [r.wineDistrict, r.adminRegion, r.location].filter(Boolean).join(', ') || '—';
    const producer = r.winery || r.grapeProducer || '—';
    const colorBadge = r.color
      ? `<span class="color-badge ${r.color.includes('бел')?'badge-white':r.color.includes('крас')?'badge-red':'badge-rose'}">${e(r.color)}</span>`
      : '—';
    const alc = r.alcohol != null ? `${r.alcohol}&thinsp;%` : '<span class="nd">н/д</span>';

    return `<tr>
      <td class="td-idx">${start + i + 1}</td>
      <td class="td-date">${e(r.researchDate||'—')}</td>
      <td class="td-region">${e(region)}</td>
      <td class="td-producer">${e(producer)}</td>
      <td class="td-color">${colorBadge}</td>
      <td class="td-sort">${e(r.sort||r.name||'—')}</td>
      <td class="td-year">${r.harvestYear??'—'}</td>
      <td class="td-alcohol">${alc}</td>
      <td class="td-extra">
        <button class="btn-extra" data-i="${start+i}" title="Аналитический блок">
          <span class="btn-extra-desktop">Доп.</span>
          <span class="btn-extra-mobile" aria-hidden="true">ℹ️</span>
        </button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-extra').forEach(btn =>
    btn.addEventListener('click', () => openModal(S.filtered[+btn.dataset.i]))
  );

  renderPagination();
}

/* ════════════════════════════════════════════════ */
/*  PAGINATION                                      */
/* ════════════════════════════════════════════════ */
function renderPagination() {
  const pg    = document.getElementById('pagination');
  if (!pg) return;
  const total = Math.ceil(S.filtered.length / PER_PAGE);
  if (total <= 1) { pg.innerHTML = ''; return; }

  const pages = pagesToShow(S.page, total);
  let html = `<button class="pg-btn" ${S.page===1?'disabled':''} data-p="${S.page-1}">‹</button>`;
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i-1] > 1) html += `<span class="pg-ellipsis">…</span>`;
    html += `<button class="pg-btn${p===S.page?' pg-active':''}" data-p="${p}">${p}</button>`;
  });
  html += `<button class="pg-btn" ${S.page===total?'disabled':''} data-p="${S.page+1}">›</button>`;
  html += `<span class="pg-info">${S.page}/${total} · ${S.filtered.length} обр.</span>`;
  pg.innerHTML = html;

  pg.querySelectorAll('.pg-btn:not([disabled])').forEach(btn =>
    btn.addEventListener('click', () => {
      S.page = +btn.dataset.p;
      render();
      document.getElementById('tableWrap')?.scrollIntoView({ behavior:'smooth', block:'start' });
    })
  );
}

function pagesToShow(cur, tot) {
  const d=2, r=[];
  for (let i=Math.max(1,cur-d); i<=Math.min(tot,cur+d); i++) r.push(i);
  if (!r.includes(1)) r.unshift(1);
  if (!r.includes(tot)) r.push(tot);
  return r;
}

function updateCount() {
  const el = document.getElementById('resultCount');
  if (el) el.textContent = S.filtered.length;
}

/* ════════════════════════════════════════════════ */
/*  MODAL                                           */
/* ════════════════════════════════════════════════ */
function openModal(r) {
  const overlay = document.getElementById('analyticsOverlay');
  if (!overlay) return;

  document.getElementById('modalSampleName').textContent =
    r.name || r.sort || `Образец ${r.id}`;

  document.getElementById('modalMeta').innerHTML =
    [r.sort&&`Сорт: <strong>${e(r.sort)}</strong>`,
     r.harvestYear&&`Год: <strong>${r.harvestYear}</strong>`,
     r.color&&`Цвет: <strong>${e(r.color)}</strong>`,
     r.productType&&`<strong>${e(r.productType)}</strong>`]
    .filter(Boolean).join(' · ');

  // Org block
  const orgLines = ORG_FIELDS
    .map(f => r[f.k] ? `<div class="modal-info-row"><b>${e(f.l)}:</b> ${e(r[f.k])}</div>` : '')
    .join('');
  document.getElementById('modalOrgInfo').innerHTML = orgLines || '<div class="modal-info-row nd">Нет данных</div>';

  // GOST
  document.getElementById('modalGost').innerHTML = renderFieldGroup(r, GOST_FIELDS);

  // Extra
  document.getElementById('modalExtra').innerHTML = renderFieldGroup(r, EXTRA_FIELDS);

  overlay.classList.add('open');
  document.body.classList.add('modal-open');
}

function renderFieldGroup(r, fields) {
  return fields.map(f => {
    const v = r[f.k];
    const empty = v === null || v === undefined;
    return `<div class="analytic-row${empty?' analytic-nd':''}">
      <span class="analytic-label">${e(f.l)}</span>
      <span class="analytic-val">${
        empty ? '<span class="nd">н/д</span>'
              : `<strong>${e(String(v))}</strong>${f.u?` <span class="unit">${e(f.u)}</span>`:''}`
      }</span>
    </div>`;
  }).join('');
}

function closeModal() {
  document.getElementById('analyticsOverlay')?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

/* ════════════════════════════════════════════════ */
/*  EVENTS                                          */
/* ════════════════════════════════════════════════ */
function bindEvents() {
  // Search
  let st;
  document.getElementById('searchInput')?.addEventListener('input', () => {
    clearTimeout(st); st = setTimeout(applyFilters, 200);
  });

  // Selects
  ['filterYear','filterColor','filterRegion'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', applyFilters));

  // Reset
  document.getElementById('btnResetFilters')?.addEventListener('click', () => {
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    ['filterYear','filterColor','filterRegion'].forEach(id => {
      const s = document.getElementById(id); if (s) s.value = '';
    });
    applyFilters();
  });

  // Column sort
  document.querySelectorAll('#wineTable thead th[data-col]').forEach(th =>
    th.addEventListener('click', () => sortBy(th.dataset.col)));

  // Modal close
  document.getElementById('analyticsOverlay')
    ?.querySelector('.modal-close')
    ?.addEventListener('click', closeModal);
  document.getElementById('analyticsOverlay')
    ?.addEventListener('click', ev => { if (ev.target.id==='analyticsOverlay') closeModal(); });
  document.addEventListener('keydown', ev => { if (ev.key==='Escape') closeModal(); });
}

/* ── Utility ─────────────────────────────────────── */
function e(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Start ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  init();
});
