// /aromaty/ — колесо ароматов: категории → группы → тона; сравнение до трёх сортов.
// Данные выводятся только через textContent; innerHTML — лишь для постоянных SVG-иконок.
import taxonomy from '../data/aroma/taxonomy.json';
import aroma from '../data/aroma/varieties.json';
import { WHEEL, MAX_COMPARE, layout, arcPath, textArc, radialLabel, splitLabel, readAromaState, writeAromaState } from '../lib/wheel.js';
import { plural, capitalize } from '../lib/format.js';
import { pageUrl } from '../site/site.js';

const NS = 'http://www.w3.org/2000/svg';
const { categories, descriptors } = layout(taxonomy);
const BY_ID = new Map(descriptors.map((d) => [d.id, d]));
const PROFILES = aroma.varieties;            // сорт → { id тона → { intensity, evidence[] } }
const SOURCES = aroma.sources;
const VARIETIES = Object.keys(PROFILES);
const STATUS_CHECK = 'интернет, проверить';
const TONE_WORDS = ['тон', 'тона', 'тонов'];
const collator = new Intl.Collator('ru');
const shortCategory = (name) => name.split('—')[0].trim();

const $ = (sel) => document.querySelector(sel);
const box = $('#wheel-box');
const tip = $('#wheel-tip');
const detailsBody = $('#details-body');

let state = readAromaState(window.location.search, VARIETIES, descriptors.map((d) => d.id));
let focusId = state.descriptor ?? descriptors[0].id;

// ── Помощники DOM ────────────────────────────────────────────────────────

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

function svgEl(tag, attrs = {}, text = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  if (text !== null) node.textContent = text;
  return node;
}

const holders = (id) => VARIETIES.filter((v) => PROFILES[v][id])
  .sort((a, b) => PROFILES[b][id].intensity - PROFILES[a][id].intensity || collator.compare(a, b));
const seriesClass = (variety) => `series-${state.varieties.indexOf(variety) + 1}`;

/** Три точки интенсивности + текст «2 из 3». */
function meter(intensity) {
  const dots = el('span', { class: 'meter', 'aria-hidden': 'true' });
  for (let i = 1; i <= 3; i += 1) dots.append(el('span', { class: i <= intensity ? 'meter__dot is-on' : 'meter__dot' }));
  return el('span', { class: 'meter-wrap' }, dots, el('span', { class: 'meter__text' }, `${intensity} из 3`));
}

// ── Колесо: неизменная часть строится один раз ───────────────────────────

const svg = svgEl('svg', {
  viewBox: `0 0 ${WHEEL.size} ${WHEEL.size}`, class: 'wheel__svg', role: 'group',
  'aria-labelledby': 'wheel-title', 'aria-describedby': 'wheel-help',
});
const bandsLayer = svgEl('g', { class: 'bands' });
const toneNodes = new Map();

function buildWheel() {
  const [c0, c1] = WHEEL.rings.category;
  const [g0, g1] = WHEEL.rings.group;
  const [d0, d1] = WHEEL.rings.descriptor;
  const defs = svgEl('defs');
  const catLayer = svgEl('g', { class: 'ring ring--category', 'aria-hidden': 'true' });
  const groupLayer = svgEl('g', { class: 'ring ring--group', 'aria-hidden': 'true' });
  const toneLayer = svgEl('g', { class: 'ring ring--tone' });

  for (const cat of categories) {
    catLayer.append(svgEl('path', { d: arcPath(c0, c1, cat.start, cat.end), class: `cat cat--${cat.id}` }));
    const pathId = `cat-arc-${cat.id}`;
    defs.append(svgEl('path', { id: pathId, d: textArc((c0 + c1) / 2, cat.start, cat.end) }));
    const label = svgEl('text', { class: 'cat__label', 'dominant-baseline': 'central' });
    label.append(svgEl('textPath', { href: `#${pathId}`, startOffset: '50%', 'text-anchor': 'middle' }, shortCategory(cat.name)));
    catLayer.append(label);

    for (const group of cat.groups) {
      groupLayer.append(svgEl('path', { d: arcPath(g0, g1, group.start, group.end), class: `group group--${cat.id}` }));
      groupLayer.append(radialText(group.name, (g0 + g1) / 2, (group.start + group.end) / 2, 12, 'group__label'));
    }
  }

  for (const d of descriptors) {
    const node = svgEl('g', { class: 'tone', role: 'button', tabindex: '-1', 'data-id': d.id });
    node.append(svgEl('path', { d: arcPath(d0, d1, d.start, d.end), class: 'tone__cell' }));
    node.append(radialText(d.name, (d0 + d1) / 2, (d.start + d.end) / 2, 13, 'tone__label'));
    toneLayer.append(node);
    toneNodes.set(d.id, node);
  }

  const center = svgEl('g', { class: 'center', 'aria-hidden': 'true' });
  center.append(svgEl('circle', { cx: WHEEL.center, cy: WHEEL.center, r: c0 - 4 }));
  center.append(svgEl('text', { x: WHEEL.center, y: WHEEL.center - 10, class: 'center__num', 'text-anchor': 'middle' }, String(descriptors.length)));
  center.append(svgEl('text', { x: WHEEL.center, y: WHEEL.center + 14, class: 'center__label', 'text-anchor': 'middle' }, 'тонов'));

  svg.append(defs, catLayer, groupLayer, toneLayer, bandsLayer, center);
  box.append(svg);
}

function radialText(text, r, angle, maxChars, cls) {
  const { x, y, rotate } = radialLabel(r, angle);
  const lines = splitLabel(text, maxChars);
  const node = svgEl('text', { x, y, transform: `rotate(${rotate} ${x} ${y})`, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  // пробел между строками: видимый текст «апельсиновая цедра», а не «апельсиноваяцедра» (WCAG 2.5.3)
  lines.forEach((line, i) => node.append(i ? ' ' : '', svgEl('tspan', { x, dy: lines.length === 1 ? 0 : i === 0 ? '-0.55em' : '1.1em' }, line)));
  return node;
}

// ── Колесо: то, что зависит от выбора ────────────────────────────────────

function toneLabel(d) {
  const parts = [`${capitalize(d.name)} (${d.group})`];
  if (state.varieties.length) {
    for (const v of state.varieties) parts.push(PROFILES[v][d.id] ? `${v}: ${PROFILES[v][d.id].intensity} из 3` : `${v}: нет`);
  } else {
    const n = holders(d.id).length;
    parts.push(n ? `встречается у ${n} ${plural(n, ['сорта', 'сортов', 'сортов'])}` : 'не встречается в источниках');
  }
  return parts.join('; ');
}

function updateWheel() {
  const selected = state.varieties;
  for (const d of descriptors) {
    const node = toneNodes.get(d.id);
    const present = selected.length ? selected.some((v) => PROFILES[v][d.id]) : holders(d.id).length > 0;
    node.classList.toggle('is-present', present);
    node.classList.toggle('is-active', d.id === state.descriptor);
    node.setAttribute('aria-pressed', String(d.id === state.descriptor));
    node.setAttribute('aria-label', toneLabel(d));
    node.setAttribute('tabindex', d.id === focusId ? '0' : '-1');
  }

  // Полосы сортов: у каждого сорта своё кольцо; длина полосы = интенсивность (1–3)
  bandsLayer.replaceChildren();
  const [r0, r1] = WHEEL.rings.varieties;
  const width = (r1 - r0) / Math.max(selected.length, 1);
  selected.forEach((v, k) => {
    const inner = r0 + k * width;
    const g = svgEl('g', { class: `band series-${k + 1}`, 'aria-hidden': 'true' });
    g.append(svgEl('path', { d: arcPath(inner, inner + width - 2, 0, 359.99), class: 'band__track' }));
    for (const [id, p] of Object.entries(PROFILES[v])) {
      const d = BY_ID.get(id);
      const len = ((width - 2) * p.intensity) / 3;
      g.append(svgEl('path', { d: arcPath(inner, inner + len, d.start + 0.4, d.end - 0.4), class: 'band__bar' }));
    }
    bandsLayer.append(g);
  });

  const legend = $('#wheel-legend');
  legend.replaceChildren(...selected.map((v) => {
    const n = Object.keys(PROFILES[v]).length;
    return el('li', {}, el('span', { class: `swatch ${seriesClass(v)}`, 'aria-hidden': 'true' }), `${v} — `,
      n ? `${n} ${plural(n, TONE_WORDS)}` : 'нет данных');
  }));
  if (selected.length) legend.append(el('li', { class: 'muted' }, 'длина полосы снаружи — интенсивность тона, 1–3'));
}

// ── Подсказка при наведении и фокусе ─────────────────────────────────────

function showTip(id, clientX, clientY) {
  const d = BY_ID.get(id);
  tip.replaceChildren(el('strong', {}, capitalize(d.name)), el('span', { class: 'muted' }, ` · ${d.group}`));
  const list = state.varieties.length
    ? state.varieties.map((v) => el('span', { class: 'tip__row' }, el('span', { class: `swatch ${seriesClass(v)}`, 'aria-hidden': 'true' }),
      `${v}: ${PROFILES[v][id] ? `${PROFILES[v][id].intensity} из 3` : 'нет'}`))
    : [el('span', { class: 'tip__row' }, (() => { const n = holders(id).length; return n ? `у ${n} ${plural(n, ['сорта', 'сортов', 'сортов'])}` : 'в источниках не встречается'; })())];
  tip.append(...list);
  const rect = box.getBoundingClientRect();
  tip.hidden = false;
  const x = Math.min(Math.max(clientX - rect.left, 8), rect.width - tip.offsetWidth - 8);
  tip.style.left = `${x}px`;
  tip.style.top = `${clientY - rect.top + 16}px`;
}

function tipForNode(node) {
  const r = node.getBoundingClientRect();
  showTip(node.dataset.id, r.left + r.width / 2, r.top + r.height / 2);
}

// ── Подробности о тоне ───────────────────────────────────────────────────

function evidenceItem(e) {
  const src = SOURCES[e.source];
  const cite = el('p', { class: 'evidence__source' },
    el('a', { href: src.url, rel: 'noopener', target: '_blank' }, src.title || src.url, el('span', { class: 'visually-hidden' }, ' (откроется в новой вкладке)')),
    ` · ${src.type}, обращение ${src.accessed}`);
  if (e.status === 'check') cite.append(' · ', el('span', { class: 'mark' }, STATUS_CHECK));
  return el('li', { class: 'evidence' }, el('blockquote', {}, `«${e.quote}»`), cite);
}

function renderDetails() {
  const id = state.descriptor;
  if (!id) {
    detailsBody.replaceChildren(el('p', { class: 'muted' }, 'Выберите тон на колесе — здесь появятся сорта, интенсивность, вещества, отвечающие за тон, и источники.'));
    return;
  }
  const d = BY_ID.get(id);
  const list = holders(id);
  const head = [el('p', { class: 'overline' }, `${shortCategory(d.category)} › ${d.group}`), el('h3', { class: 'details__title' }, capitalize(d.name))];
  if (!list.length) {
    detailsBody.replaceChildren(...head, el('p', {}, 'В собранных источниках этот тон не указан ни для одного сорта.'));
    return;
  }
  const items = list.map((v) => {
    const p = PROFILES[v][id];
    const compounds = [...new Set(p.evidence.map((e) => e.compound).filter(Boolean))];
    const actions = el('p', { class: 'details__actions' },
      el('a', { href: `${pageUrl('baza')}?variety=${encodeURIComponent(v)}` }, 'Образцы в базе'));
    if (!state.varieties.includes(v) && state.varieties.length < MAX_COMPARE) {
      actions.prepend(el('button', { type: 'button', class: 'link-button', 'data-add': v }, 'Сравнить'), ' · ');
    }
    return el('li', { class: 'holder' },
      el('p', { class: 'holder__head' },
        state.varieties.includes(v) ? el('span', { class: `swatch ${seriesClass(v)}`, 'aria-hidden': 'true' }) : null,
        el('strong', {}, v), ' ', meter(p.intensity)),
      compounds.length ? el('p', { class: 'holder__compound' }, el('span', { class: 'muted' }, 'Отвечает за тон: '), compounds.join('; ')) : null,
      el('ul', { class: 'evidence-list' }, ...p.evidence.map(evidenceItem)),
      actions);
  });
  detailsBody.replaceChildren(...head, el('p', { class: 'muted' }, `Встречается у ${list.length} ${plural(list.length, ['сорта', 'сортов', 'сортов'])}:`),
    el('ul', { class: 'holders' }, ...items));
}

// ── Текстовая версия колеса: профили выбранных сортов ────────────────────

function renderProfile() {
  const root = $('#profile');
  if (!state.varieties.length) {
    root.replaceChildren(el('p', { class: 'muted' }, 'Выберите сорт в списке «Сорта для сравнения» — здесь появится его профиль аромата списком.'));
    return;
  }
  root.replaceChildren(...state.varieties.map((v) => {
    const profile = PROFILES[v];
    const card = el('section', { class: 'profile panel', 'aria-label': `Профиль аромата: ${v}` },
      el('h3', { class: 'profile__title' }, el('span', { class: `swatch ${seriesClass(v)}`, 'aria-hidden': 'true' }), v));
    if (!Object.keys(profile).length) {
      card.append(el('p', {}, 'Описание аромата для сорта ещё не внесено.'));
      return card;
    }
    for (const cat of categories) {
      const groups = cat.groups.map((g) => [g, g.descriptors.filter((d) => profile[d.id])]).filter(([, ds]) => ds.length);
      if (!groups.length) continue;
      const dl = el('dl', { class: 'profile__groups' });
      for (const [g, ds] of groups) {
        dl.append(el('dt', {}, g.name), el('dd', {}, ...ds.flatMap((d, i) => [
          i ? ', ' : '', el('button', { type: 'button', class: 'link-button', 'data-tone': d.id }, d.name), ` ${profile[d.id].intensity}/3`])));
      }
      card.append(el('p', { class: 'overline' }, shortCategory(cat.name)), dl);
    }
    card.append(el('p', {}, el('a', { href: `${pageUrl('baza')}?variety=${encodeURIComponent(v)}` }, `Образцы сорта «${v}» в базе`)));
    return card;
  }));
}

// ── Выбор сортов ─────────────────────────────────────────────────────────

function buildPicker() {
  const list = $('#picker-list');
  for (const v of VARIETIES) {
    const n = Object.keys(PROFILES[v]).length;
    const id = `pick-${VARIETIES.indexOf(v)}`;
    list.append(el('div', { class: 'picker__item' },
      el('input', { type: 'checkbox', id, value: v }),
      el('label', { for: id }, el('span', { class: 'picker__swatch swatch', 'aria-hidden': 'true' }), v,
        el('span', { class: 'picker__n muted' }, n ? ` · ${n}` : ' · нет данных'))));
  }
}

function updatePicker() {
  const full = state.varieties.length >= MAX_COMPARE;
  for (const input of document.querySelectorAll('#picker-list input')) {
    const on = state.varieties.includes(input.value);
    input.checked = on;
    input.disabled = !on && full;
    input.nextElementSibling.querySelector('.picker__swatch').className = `picker__swatch swatch ${on ? seriesClass(input.value) : ''}`;
  }
  $('#picker-count').textContent = `(${state.varieties.length} из ${MAX_COMPARE})`;
  $('#picker-hint').textContent = full ? 'Выбрано три сорта — снимите отметку, чтобы выбрать другой.' : 'Можно выбрать до трёх.';
}

// ── Общая отрисовка и события ────────────────────────────────────────────

function render() {
  updatePicker();
  updateWheel();
  renderDetails();
  renderProfile();
  window.history.replaceState(null, '', window.location.pathname + writeAromaState(state) + window.location.hash);
}

function selectTone(id, { focus = false } = {}) {
  state.descriptor = id;
  focusId = id;
  render();
  if (focus) toneNodes.get(id).focus();
}

function bindEvents() {
  $('#picker-list').addEventListener('change', (e) => {
    const v = e.target.value;
    state.varieties = e.target.checked ? [...state.varieties, v].slice(0, MAX_COMPARE) : state.varieties.filter((x) => x !== v);
    render();
  });

  svg.addEventListener('click', (e) => {
    const node = e.target.closest('.tone');
    if (node) selectTone(node.dataset.id);
  });
  svg.addEventListener('keydown', (e) => {
    const node = e.target.closest('.tone');
    if (!node) return;
    const i = descriptors.findIndex((d) => d.id === node.dataset.id);
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (e.key in moves) next = descriptors[(i + moves[e.key] + descriptors.length) % descriptors.length];
    else if (e.key === 'Home') next = descriptors[0];
    else if (e.key === 'End') next = descriptors.at(-1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectTone(node.dataset.id, { focus: true });
      return;
    }
    if (!next) return;
    e.preventDefault();
    node.setAttribute('tabindex', '-1');
    focusId = next.id;
    const target = toneNodes.get(next.id);
    target.setAttribute('tabindex', '0');
    target.focus();
  });
  svg.addEventListener('pointerover', (e) => {
    const node = e.target.closest('.tone');
    if (node) showTip(node.dataset.id, e.clientX, e.clientY);
  });
  svg.addEventListener('pointermove', (e) => {
    const node = e.target.closest('.tone');
    if (node && !tip.hidden) showTip(node.dataset.id, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('focusin', (e) => { const node = e.target.closest('.tone'); if (node) tipForNode(node); });
  svg.addEventListener('focusout', () => { tip.hidden = true; });

  // «Сравнить» в подробностях и тона в текстовой версии
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add && state.varieties.length < MAX_COMPARE) {
      state.varieties = [...state.varieties, add.dataset.add];
      render();
    }
    const tone = e.target.closest('[data-tone]');
    if (tone) {
      selectTone(tone.dataset.tone);
      $('#details').scrollIntoView({ block: 'nearest' });
    }
  });
}

// ── Запуск ───────────────────────────────────────────────────────────────

buildWheel();
buildPicker();
bindEvents();
render();
