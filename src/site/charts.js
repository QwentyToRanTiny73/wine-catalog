// Графики главной — обычный HTML, собирается при сборке (без библиотек, работает без JS).
// Правила оформления — по скиллу dataviz: столбики ≤ 24 px со скруглённым верхом,
// подписи значений вместо оси, текст — цветом текста (не цветом данных),
// у каждой метки рядом подпись, цвета проверены validate_palette.js (см. docs/decisions.md).
import { escapeHtml as esc, plural } from '../lib/format.js';
import { WINE_COLORS, SAMPLE_WORDS } from '../lib/domain.js';
import { pageUrl } from './site.js';

/** Части «по цвету вина» для набора образцов: [{ key, plural, count }], без нулевых. */
export function colorParts(samples) {
  return WINE_COLORS.map((c) => ({ ...c, count: samples.filter((s) => s.color === c.value).length }))
    .filter((p) => p.count > 0);
}

/** Тонкая полоса долей без текста (подписи и цифры — рядом, в списке). */
export function segbar(parts) {
  const blocks = parts.map((p) => `<span class="segbar__part segbar__part--${p.key}" style="flex-grow:${p.count}"></span>`);
  return `<div class="segbar" aria-hidden="true">${blocks.join('')}</div>`;
}

/** Образцы по годам урожая: столбик — ссылка на базу с фильтром по году. */
export function renderYearColumns({ stats }) {
  const max = Math.max(...stats.byYear.map((y) => y.count));
  const items = stats.byYear.map(({ year, count }) => {
    // имя ссылки собирается из видимого текста («2017», «24») + скрытого пояснения (WCAG 2.5.3)
    return `<li>
        <a class="column" href="${pageUrl('baza')}?year=${year}" style="--v:${count};--max:${max}">
          <span class="column__year">${year}</span><span class="visually-hidden">: </span>
          <span class="column__plot">
            <span class="column__value">${count}</span><span class="visually-hidden"> ${esc(plural(count, SAMPLE_WORDS))} — открыть в базе</span>
            <span class="column__bar" aria-hidden="true"></span>
          </span>
        </a>
      </li>`;
  }).join('');
  return `<figure class="chart">
      <figcaption class="chart__title">Образцы по годам урожая</figcaption>
      <ol class="columns">${items}</ol>
      <p class="chart__hint">Нажмите на столбик, чтобы открыть образцы этого года</p>
    </figure>`;
}

/** Доли по цвету: тонкая полоса без текста + список с цифрами (подписи — в списке). */
export function renderColorSplit({ data }) {
  const parts = colorParts(data.samples);
  const total = data.samples.length;
  const pct = (n) => `${Math.round((n / total) * 100) || '<1'}%`;
  const rows = parts.map((p) => `<li>
        <span class="swatch swatch--${p.key}" aria-hidden="true"></span>
        <span class="split__name">${p.plural}</span>
        <span class="split__count num">${p.count}</span>
        <span class="split__share num">${pct(p.count)}</span>
      </li>`).join('');
  return `<figure class="chart">
      <figcaption class="chart__title">По цвету вина</figcaption>
      ${segbar(parts)}
      <ul class="split">${rows}</ul>
    </figure>`;
}

/** Декоративная линия хроматограммы для первого экрана (не данные — aria-hidden). */
export function renderChromatogram() {
  // пики: [положение 0..1, высота 0..1, ширина]
  const peaks = [[0.08, 0.25, 0.012], [0.16, 0.62, 0.01], [0.22, 0.18, 0.015], [0.31, 0.95, 0.009],
    [0.37, 0.4, 0.012], [0.46, 0.7, 0.01], [0.55, 0.22, 0.02], [0.63, 0.82, 0.008], [0.7, 0.33, 0.012],
    [0.79, 0.55, 0.01], [0.86, 0.15, 0.018], [0.93, 0.45, 0.011]];
  const W = 1200;
  const H = 160;
  const base = H - 8;
  const pts = [];
  for (let i = 0; i <= 600; i += 1) {
    const x = i / 600;
    const y = peaks.reduce((acc, [p, h, w]) => acc + h * Math.exp(-((x - p) ** 2) / (2 * w * w)), 0);
    pts.push(`${(x * W).toFixed(1)},${(base - Math.min(y, 1) * (H - 20)).toFixed(1)}`);
  }
  return `<svg class="hero__art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 ${base}H${W}" class="hero__art-base"/>
      <polyline points="${pts.join(' ')}" class="hero__art-line"/>
    </svg>`;
}
