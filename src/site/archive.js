// /arkhiv/ — сводка по годам урожая. Собирается из данных при сборке (страница без JavaScript).
import { escapeHtml as esc, plural } from '../lib/format.js';
import { icon } from './icons.js';
import { WINE_COLORS, SAMPLE_WORDS } from '../lib/domain.js';

const TOP_VARIETIES = 6;
const collator = new Intl.Collator('ru');

/** Счётчик значений, отсортированный по убыванию, при равенстве — по алфавиту. */
function ranked(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
}

function yearCard(year, samples, base) {
  const n = samples.length;
  const colors = WINE_COLORS.map((c) => ({ ...c, count: samples.filter((s) => s.color === c.value).length })).filter((c) => c.count);
  const varieties = ranked(samples.flatMap((s) => s.varieties));
  const unknown = samples.filter((s) => !s.varieties.length).length;
  const districts = ranked(samples.map((s) => s.wineDistrict).filter(Boolean));
  const wineMaterial = samples.filter((s) => s.productType === 'виноматериал').length;
  const wine = samples.filter((s) => s.productType === 'вино').length;

  const shown = varieties.slice(0, TOP_VARIETIES).map(([v, c]) => `${esc(v)}&nbsp;<span class="num">(${c})</span>`).join(', ');
  const rest = varieties.length - TOP_VARIETIES;
  const varietyText = [shown, rest > 0 ? `и ещё ${rest}` : '', unknown ? `без указания сорта — <span class="num">${unknown}</span>` : '']
    .filter(Boolean).join('; ');

  return `<li class="year-card">
      <div class="year-card__head">
        <h2 class="year-card__year">${year}</h2>
        <p class="year-card__count"><span class="num">${n}</span> ${plural(n, SAMPLE_WORDS)}</p>
      </div>
      <div class="segbar" aria-hidden="true">${colors.map((c) => `<span class="segbar__part segbar__part--${c.key}" style="flex-grow:${c.count}"></span>`).join('')}</div>
      <ul class="year-card__colors">${colors.map((c) => `<li><span class="swatch swatch--${c.key}" aria-hidden="true"></span>${c.plural} <span class="num">${c.count}</span></li>`).join('')}</ul>
      <dl class="year-card__facts">
        <div><dt>Сорта (${varieties.length})</dt><dd>${varietyText || '—'}</dd></div>
        <div><dt>Районы АВВР (${districts.length})</dt><dd>${districts.map(([d, c]) => `${esc(d)}&nbsp;<span class="num">(${c})</span>`).join(', ') || '—'}</dd></div>
        <div><dt>Тип продукции</dt><dd>виноматериалов <span class="num">${wineMaterial}</span>, вин <span class="num">${wine}</span></dd></div>
      </dl>
      <a class="more-link" href="${base}baza/?year=${year}">Открыть образцы ${year} года${icon('arrowRight')}</a>
    </li>`;
}

export function renderArchive({ data, base }) {
  const byYear = new Map();
  for (const s of data.samples) {
    if (!Number.isInteger(s.harvestYear)) continue;
    if (!byYear.has(s.harvestYear)) byYear.set(s.harvestYear, []);
    byYear.get(s.harvestYear).push(s);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  return `<ol class="year-cards">${years.map((y) => yearCard(y, byYear.get(y), base)).join('')}</ol>`;
}
