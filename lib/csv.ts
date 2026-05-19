export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (ch === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    currentCell += ch;
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

export function rowsToObjects(
  rows: string[][],
): Array<Record<string, string>> {
  if (!rows.length) return [];
  const [headerRow, ...body] = rows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  return body.map((row) => {
    const out: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i];
      if (!key) continue;
      out[key] = (row[i] || "").trim();
    }
    return out;
  });
}
