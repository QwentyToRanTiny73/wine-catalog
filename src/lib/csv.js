// CSV для таблиц в data/: разделитель «;», BOM, строки через \r\n, кавычки — только где нужны.
// Формат совпадает с тем, что пишет Python csv (scripts/*.py): правка из /admin/ меняет в git
// только изменённые строки.

const BOM = '﻿';

/** Текст CSV → массив объектов по заголовку. Понимает кавычки, «""» и переводы строк внутри поля. */
export function parseCsv(text, delimiter = ';') {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\r') { /* \r\n — конец строки обработается на \n */ }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, j) => [h, r[j] ?? '']))) };
}

function quote(value, delimiter) {
  const s = String(value ?? '');
  return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Массив объектов → текст CSV с BOM (как Python csv с delimiter=';' и utf-8-sig). */
export function serializeCsv(header, rows, delimiter = ';') {
  const lines = [header, ...rows.map((r) => header.map((h) => r[h]))]
    .map((cells) => cells.map((c) => quote(c, delimiter)).join(delimiter));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
