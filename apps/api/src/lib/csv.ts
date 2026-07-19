/**
 * Minimal RFC4180-ish CSV read/write — no dependency added since our own export is the only writer
 * most imports will ever see, and the parser only needs to handle what that writer (or Excel/Sheets,
 * which follow the same quoting rules) produces: comma-separated fields, double-quote-wrapped fields
 * containing commas/quotes/newlines, `""` as an escaped quote.
 */

export function stringifyCsvField(value: string): string {
  // A cell value starting with =/+/-/@ is interpreted as a formula by Excel/Sheets on open
  // (CSV/formula injection, CWE-1236) — prefix with a leading apostrophe to force text, same
  // mitigation Excel itself uses for "safe" exports.
  const escaped = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

export function stringifyCsv(rows: string[][]): string {
  return rows.map((row) => row.map(stringifyCsvField).join(',')).join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) pushRow();
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}
