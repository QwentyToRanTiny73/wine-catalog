// Колесо ароматов: геометрия и состояние в адресе — чистые функции (test/wheel.test.js).
// Углы — в градусах, 0° наверху, по часовой стрелке.

export const WHEEL = {
  size: 800,
  center: 400,
  rings: {
    category: [70, 138],     // категории: по происхождению аромата
    group: [138, 228],       // группы
    descriptor: [228, 330],  // дескрипторы (на них нажимают)
    varieties: [334, 396],   // полосы выбранных сортов: длина = интенсивность
  },
};

export const MAX_COMPARE = 3;

/** Раскладка таксономии по кругу: каждому дескриптору — равный сектор. */
export function layout(taxonomy) {
  const total = taxonomy.categories.reduce((n, c) => n + c.groups.reduce((m, g) => m + g.descriptors.length, 0), 0);
  const step = 360 / total;
  let angle = 0;
  const descriptors = [];
  const categories = taxonomy.categories.map((cat) => {
    const catStart = angle;
    const groups = cat.groups.map((group) => {
      const groupStart = angle;
      const items = group.descriptors.map((d) => {
        const item = { ...d, start: angle, end: angle + step, group: group.name, category: cat.name, categoryId: cat.id };
        angle += step;
        descriptors.push(item);
        return item;
      });
      return { ...group, start: groupStart, end: angle, descriptors: items, categoryId: cat.id };
    });
    return { ...cat, start: catStart, end: angle, groups };
  });
  return { categories, descriptors, step };
}

const round = (n) => Math.round(n * 100) / 100;

/** Точка на окружности радиуса r под углом a. */
export function polar(r, a, c = WHEEL.center) {
  const rad = (a * Math.PI) / 180;
  return [round(c + r * Math.sin(rad)), round(c - r * Math.cos(rad))];
}

/** Путь кольцевого сектора от r0 до r1 и от угла a0 до a1. */
export function arcPath(r0, r1, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

/** Дуга по окружности (для подписи вдоль кольца); слева направо читается и внизу колеса. */
export function textArc(r, a0, a1) {
  const mid = (a0 + a1) / 2;
  const bottom = mid > 90 && mid < 270;
  const [from, to] = bottom ? [a1, a0] : [a0, a1];
  const [x0, y0] = polar(r, from);
  const [x1, y1] = polar(r, to);
  return `M${x0} ${y0}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${bottom ? 0 : 1} ${x1} ${y1}`;
}

/**
 * Подпись вдоль радиуса: положение и поворот. На левой половине текст разворачивается,
 * чтобы не читаться вверх ногами.
 */
export function radialLabel(r, a) {
  const [x, y] = polar(r, a);
  const left = a > 180;
  return { x, y, rotate: round(left ? a + 90 : a - 90) };
}

/** Длинную подпись — в две строки по пробелу ближе к середине. */
export function splitLabel(text, maxChars) {
  if (text.length <= maxChars || !text.includes(' ')) return [text];
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i += 1) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [text.slice(0, best), text.slice(best + 1)];
}

/** Состояние из адреса: ?v=Сира,Мерло&d=chernyj-perec. Неизвестное отбрасывается, сортов — не больше трёх. */
export function readAromaState(search, varietyNames, descriptorIds) {
  const p = new URLSearchParams(search);
  const known = new Set(varietyNames);
  const varieties = [...new Set((p.get('v') ?? '').split(',').map((s) => s.trim()).filter((v) => known.has(v)))].slice(0, MAX_COMPARE);
  const d = p.get('d');
  return { varieties, descriptor: d && descriptorIds.includes(d) ? d : null };
}

export function writeAromaState({ varieties, descriptor }) {
  const p = new URLSearchParams();
  if (varieties.length) p.set('v', varieties.join(','));
  if (descriptor) p.set('d', descriptor);
  const text = p.toString();
  return text ? `?${text}` : '';
}
