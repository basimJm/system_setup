import { CSV_BOM, CSV_FORMULA_PREFIXES, CSV_MIME } from '@/constants/charts';

export type CsvCell = string | number | null | undefined;

/** One cell: formulas neutralised, quotes/commas/newlines escaped (RFC 4180). */
export function csvCell(cell: CsvCell): string {
  let text = cell === null || cell === undefined ? '' : String(cell);
  if (CSV_FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix)) && Number.isNaN(Number(text)))
    text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Saves `text` as a file through a temporary link. UTF-8 BOM so Excel reads Arabic correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([CSV_BOM, csv], { type: CSV_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
