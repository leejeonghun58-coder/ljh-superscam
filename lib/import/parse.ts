import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportRow } from './types.ts';

export type ParsedImportFile = { sourceFormat: 'CSV' | 'XLSX'; rows: Array<{ rowNumber: number; values: ImportRow }> };

export function parseCsv(content: string): { columns: string[]; rows: ImportRow[] } {
  const parsed = Papa.parse<ImportRow>(content, { header: true, skipEmptyLines: 'greedy', transformHeader: (header) => header.trim() });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  return { columns: parsed.meta.fields ?? [], rows: parsed.data };
}

export function parseExcel(content: ArrayBuffer): { columns: string[]; rows: ImportRow[] } {
  const workbook = XLSX.read(content, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: null, raw: false });
  return { columns: rows.length ? Object.keys(rows[0]) : [], rows };
}

export async function parseImportFile(file: File, _importType: string): Promise<ParsedImportFile> {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'csv' && extension !== 'xlsx') throw new Error('지원하지 않는 파일 형식입니다. CSV 또는 XLSX만 업로드할 수 있습니다.');
  if (extension === 'csv') {
    const parsed = parseCsv(await file.text());
    return { sourceFormat: 'CSV', rows: parsed.rows.map((values, index) => ({ rowNumber: index + 2, values })) };
  }
  const parsed = parseExcel(await file.arrayBuffer());
  return { sourceFormat: 'XLSX', rows: parsed.rows.map((values, index) => ({ rowNumber: index + 2, values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === null ? null : String(value)])) })) };
}