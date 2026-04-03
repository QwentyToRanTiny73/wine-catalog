/* =====================================================
   WINE CATALOG — БАЗА ОБРАЗЦОВ
   baza.js  — filters, table, pagination, modal
   ===================================================== */

(function () {
  'use strict';

  /* ── Constants ──────────────────────────────────── */
  const PER_PAGE = 25;

  /* ── State ──────────────────────────────────────── */
  const state = {
    all:      [],   // full normalized dataset
    filtered: [],   // after search + filters
    sortCol:  'id',
    sortDir:  'asc',
    page:     1,
  };

  /* ── Field labels for modal ─────────────────────── */
  // Организационный блок
  const ORG_FIELDS = [
    { key: 'zone',     label: 'Зона' },
    { key: 'region',   label: 'Регион / Терруар' },
    { key: 'terroir',  label: 'Терруар' },
    { key: 'producer', label: 'Производитель винограда' },
    { key: 'winery',   label: 'Винодельня' },
  ];

  // Технический блок
  const TECH_FIELDS = [
    { key: 'name',        label: 'Название образца' },
    { key: 'sort',        label: 'Сорт' },
    { key: 'harvestYear', label: 'Год урожая' },
    { key: 'color',       label: 'Цвет вина' },
  ];

  // Аналитический блок — полный набор всех возможных полей
  const ANALYTIC_FIELDS = [
    { key: 'ph',                    label: 'pH',                               unit: '' },
    { key: 'titratedAcidity',       label: 'Титруемая кислотность',            unit: 'г/дм³' },
    { key: 'acidity',               label: 'Кислотность (тит.)',               unit: 'г/дм³' },
    { key: 'sugar',                 label: 'Сахара (общие)',                   unit: 'г/дм³' },
    { key: 'glucose',               label: 'Глюкоза',                          unit: 'г/дм³' },
    { key: 'fructose',              label: 'Фруктоза',                         unit: 'г/дм³' },
    { key: 'lemonAcid',             label: 'Лимонная кислота',                 unit: 'г/дм³' },
    { key: 'wineAcid',              label: 'Винная кислота',                   unit: 'г/дм³' },
    { key: 'appleAcid',             label: 'Яблочная кислота',                 unit: 'г/дм³' },
    { key: 'amberAcid',             label: 'Янтарная кислота',                 unit: 'г/дм³' },
    { key: 'lacticAcid',            label: 'Молочная кислота',                 unit: 'г/дм³' },
    { key: 'aceticAcid',            label: 'Уксусная кислота',                 unit: 'г/дм³' },
    { key: 'ethanol',               label: 'Летучие кислоты / Этанол',         unit: 'г/дм³' },
    { key: 'glycerin',              label: 'Глицерин',                         unit: 'г/дм³' },
    { key: 'biotic',                label: 'Биотик',                           unit: 'г/дм³' },
    { key: 'chlorides',             label: 'Хлориды',                          unit: 'мг/дм³' },
    { key: 'calcium',               label: 'Кальций (Ca²⁺)',                   unit: 'мг/дм³' },
    { key: 'phenolicSubstances',    label: 'Сумма фенольных веществ',          unit: 'мг/дм³' },
    { key: 'totalExtract',          label: 'Общий экстракт',                   unit: 'г/дм³' },
    { key: 'reducedExtract',        label: 'Приведённый экстракт',             unit: 'г/дм³' },
    { key: 'residualExtract',       label: 'Остаточный экстракт',              unit: 'г/дм³' },
    { key: 'alcoholByTimofeev',     label: 'Спирт (по Тимофееву)',             unit: '% об.' },
    { key: 'alcoholByDistillation', label: 'Спирт (дистилляция)',              unit: '% об.' },
    { key: 'freeSulfurDioxide',     label: 'SO₂ свободный',                    unit: 'мг/дм³' },
    { key: 'totalSulfurDioxide',    label: 'SO₂ общий',                        unit: 'мг/дм³' },
    { key: 'alkalineBufferCapacity',label: 'Буферная ёмкость (щелочная)',      unit: 'ммоль/дм³' },
    { key: 'electricConductivity',  label: 'Электропроводность',               unit: 'мСм/см' },
  ];

  /* ── Normalise raw data ──────────────────────────── */
  function normalise(raw) {
    return raw.map(r => ({
      ...r,
      // unify the two different "titratable acidity" field names
      _acidity:  r.titratedAcidity ?? r.acidity ?? null,
    }));
  }

  /* ── Boot ───────────────────────────────────────── */
  function init() {
    if (!Array.isArray(window.wineSamples) || !window.wineSamples.length) {
      document.getElementById('emptyState').style.display = 'block';
      return;
    }

    state.all      = normalise(window.wineSamples);
    state.filtered = [...state.all];

    populateFilters();
    applyUrlParams();   // pre-fill filters from URL query string
    bindEvents();
    applyFiltersAndRender();
  }

  /* ── Pre-fill filters from URL params ───────────── */
  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const year = params.get('year');
    if (year) {
      const sel = document.getElementById('filterYear');
      if ([...sel.options].some(o => o.value === year)) sel.value = year;
    }
    const color = params.get('color');
    if (color) {
      const sel = document.getElementById('filterColor');
      if ([...sel.options].some(o => o.value === color)) sel.value = color;
    }
    const region = params.get('region');
    if (region) {
      const sel = document.getElementById('filterRegion');
      if ([...sel.options].some(o => o.value === region)) sel.value = region;
    }
  }

  /* ── Populate filter <select> options ───────────── */
  function populateFilters() {
    const regions   = new Set();
    const sorts     = new Set();
    const years     = new Set();
    const producers = new Set();

    state.all.forEach(s => {
      if (s.region)   regions.add(s.region);
      if (s.sort)     sorts.add(s.sort);
      if (s.harvestYear) years.add(s.harvestYear);
      if (s.producer) producers.add(s.producer);
    });

    fill('filterRegion',   [...regions].sort());
    fill('filterSort',     [...sorts].sort());
    fill('filterYear',     [...years].sort((a,b) => b - a));
    fill('filterProducer', [...producers].sort());
  }

  function fill(id, values) {
    const sel = document.getElementById(id);
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  /* ── Bind all events ────────────────────────────── */
  function bindEvents() {
    // Live search
    document.getElementById('globalSearch').addEventListener('input', debounce(applyFiltersAndRender, 200));

    // Filter selects — apply on change
    ['filterRegion','filterSort','filterYear','filterColor','filterProducer'].forEach(id => {
      document.getElementById(id).addEventListener('change', applyFiltersAndRender);
    });

    // Reset
    document.getElementById('btnReset').addEventListener('click', () => {
      document.getElementById('globalSearch').value = '';
      ['filterRegion','filterSort','filterYear','filterColor','filterProducer'].forEach(id => {
        document.getElementById(id).value = '';
      });
      applyFiltersAndRender();
    });

    // Sortable columns
    document.querySelectorAll('#samplesTable thead th[data-col]').forEach(th => {
      if (th.classList.contains('no-sort')) return;
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col');
        if (state.sortCol === col) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortCol = col;
          state.sortDir = 'asc';
        }
        updateSortIndicators();
        renderTable();
      });
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modalOverlay')) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ── Filter & sort ──────────────────────────────── */
  function applyFiltersAndRender() {
    const q        = (document.getElementById('globalSearch').value || '').toLowerCase().trim();
    const region   = document.getElementById('filterRegion').value;
    const sort     = document.getElementById('filterSort').value;
    const year     = document.getElementById('filterYear').value;
    const color    = document.getElementById('filterColor').value;
    const producer = document.getElementById('filterProducer').value;

    state.filtered = state.all.filter(s => {
      if (region   && s.region   !== region)                         return false;
      if (sort     && s.sort     !== sort)                           return false;
      if (year     && String(s.harvestYear) !== String(year))        return false;
      if (color    && s.color    !== color)                          return false;
      if (producer && s.producer !== producer)                       return false;

      if (q) {
        const hay = [
          s.name, s.sort, s.region, s.terroir, s.zone,
          s.producer, s.winery, s.color, s.harvestYear,
        ].map(v => String(v ?? '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    state.page = 1;
    renderTable();
    renderPagination();
    document.getElementById('resultCount').textContent = state.filtered.length;
  }

  /* ── Sort helper ────────────────────────────────── */
  function getSortedFiltered() {
    const col = state.sortCol;
    const dir = state.sortDir;
    return [...state.filtered].sort((a, b) => {
      let av = a[col] ?? '';
      let bv = b[col] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return dir === 'asc' ? av - bv : bv - av;
      }
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      return dir === 'asc' ? av.localeCompare(bv, 'ru') : bv.localeCompare(av, 'ru');
    });
  }

  function updateSortIndicators() {
    document.querySelectorAll('#samplesTable thead th').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-col') === state.sortCol) {
        th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  /* ── Render table body ──────────────────────────── */
  function renderTable() {
    const sorted = getSortedFiltered();
    const start  = (state.page - 1) * PER_PAGE;
    const page   = sorted.slice(start, start + PER_PAGE);

    const tbody = document.getElementById('tableBody');
    const empty = document.getElementById('emptyState');

    if (!page.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = page.map(s => `
      <tr data-id="${s.id}" tabindex="0">
        <td class="row-id">${s.id}</td>
        <td>${esc(s.name || '—')}</td>
        <td>${esc(s.sort || '—')}</td>
        <td>${s.harvestYear ?? '—'}</td>
        <td><span class="badge ${colorBadge(s.color)}">${esc(s.color || '—')}</span></td>
        <td>${esc(s.region || '—')}</td>
        <td>${esc(s.producer || '—')}</td>
        <td>${esc(s.winery || '—')}</td>
        <td>${fmt(s.ph)}</td>
        <td>${fmt(s._acidity)}</td>
      </tr>
    `).join('');

    // Click & keyboard on rows
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click',  () => openModal(Number(tr.dataset.id)));
      tr.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') openModal(Number(tr.dataset.id));
      });
    });
  }

  /* ── Pagination ─────────────────────────────────── */
  function renderPagination() {
    const total = Math.ceil(state.filtered.length / PER_PAGE);
    const pg    = document.getElementById('pagination');
    if (total <= 1) { pg.innerHTML = ''; return; }

    let html = '';

    // Prev
    html += `<button class="page-btn" ${state.page===1?'disabled':''} data-pg="${state.page-1}">‹</button>`;

    // Page numbers (show window around current)
    const pages = pagesToShow(state.page, total);
    let prev = 0;
    pages.forEach(p => {
      if (p - prev > 1) html += `<span class="page-info">…</span>`;
      html += `<button class="page-btn${p===state.page?' active':''}" data-pg="${p}">${p}</button>`;
      prev = p;
    });

    // Next
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

  function pagesToShow(current, total) {
    const delta = 2;
    const range = [];
    for (let i = Math.max(1, current-delta); i <= Math.min(total, current+delta); i++) {
      range.push(i);
    }
    if (!range.includes(1)) range.unshift(1);
    if (!range.includes(total)) range.push(total);
    return range;
  }

  /* ── Modal ──────────────────────────────────────── */
  function openModal(id) {
    const s = state.all.find(x => x.id === id);
    if (!s) return;

    // Header
    document.getElementById('modalTitle').textContent = s.name || 'Образец';
    const meta = document.getElementById('modalMeta');
    meta.innerHTML = [
      s.sort       ? `<span class="modal-meta-badge">${esc(s.sort)}</span>` : '',
      s.harvestYear? `<span class="modal-meta-badge">Урожай ${s.harvestYear}</span>` : '',
      s.color      ? `<span class="modal-meta-badge">${esc(s.color)}</span>` : '',
    ].join('');

    // Org block
    document.getElementById('modalOrgBlock').innerHTML =
      renderModalFields(s, ORG_FIELDS);

    // Tech block
    document.getElementById('modalTechBlock').innerHTML =
      renderModalFields(s, TECH_FIELDS);

    // Analytic block — only show fields that exist in THIS sample (not null/undefined)
    const analyticPresent = ANALYTIC_FIELDS.filter(f => s[f.key] !== undefined && s[f.key] !== null);
    const analyticAll = analyticPresent.length
      ? ANALYTIC_FIELDS  // show all, grey out nulls
      : [];

    document.getElementById('modalAnalyticBlock').innerHTML =
      ANALYTIC_FIELDS.map(f => {
        const v = s[f.key];
        if (v === undefined) return ''; // field doesn't exist in data at all
        const isNull = v === null;
        return `
          <div class="modal-field">
            <div class="modal-field-label">${esc(f.label)}</div>
            <div class="modal-field-value${isNull?' null-val':''}">
              ${isNull ? 'н/д' : esc(String(v))}${!isNull && f.unit ? `<span class="modal-field-unit">${esc(f.unit)}</span>` : ''}
            </div>
          </div>`;
      }).join('');

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function renderModalFields(s, fields) {
    return fields.map(f => {
      const v = s[f.key];
      const isNull = v === null || v === undefined || v === '';
      return `
        <div class="modal-field">
          <div class="modal-field-label">${esc(f.label)}</div>
          <div class="modal-field-value${isNull?' null-val':''}">
            ${isNull ? 'н/д' : esc(String(v))}
          </div>
        </div>`;
    }).join('');
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Utilities ──────────────────────────────────── */
  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function fmt(v) {
    if (v === null || v === undefined || v === '') return '<span style="color:#B0A0A5">—</span>';
    return esc(String(v));
  }

  function colorBadge(color) {
    if (!color) return '';
    const c = color.toLowerCase();
    if (c.includes('бел')) return 'badge-white';
    if (c.includes('крас')) return 'badge-red';
    if (c.includes('роз')) return 'badge-rose';
    return '';
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ── Start ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
