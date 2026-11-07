// CSV для таблиц в data/: разделитель «;», BOM, строки через \r\n, кавычки — только где нужны.
// Формат совпадает с тем, что пишет Python csv (scripts/*.py): правка из /admin/ меняет в git
// только изменённые строки.

const BOM = '﻿';

/** Текст CSV → массив объектов по заголовку. Как Python csv: кавычка открывает поле только в его начале
 *  (в середине поля это обычный символ), «""» внутри кавычек — одна кавычка, пустые строки пропускаются. */
export function parseCsv(text, delimiter = ';') {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let fieldStart = true;   // ни одного символа поля ещё не прочитано
  let lineUsed = false;    // в строке что-то есть (пустую строку Python пропускает)
  const endLine = () => {
    if (lineUsed) { row.push(field); rows.push(row); }
    row = []; field = ''; fieldStart = true; lineUsed = false;
  };
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '\r') { if (src[i + 1] !== '\n') endLine(); continue; }   // \r\n — конец на \n; одиночный \r — тоже конец (как Python)
    if (ch === '\n') { endLine(); continue; }
    lineUsed = true;
    if (ch === '"' && fieldStart) { quoted = true; fieldStart = false; }
    else if (ch === delimiter) { row.push(field); field = ''; fieldStart = true; }
    else { field += ch; fieldStart = false; }
  }
  endLine();
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
