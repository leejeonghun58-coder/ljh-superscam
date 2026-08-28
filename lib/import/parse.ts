import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getImportSchema } from './schema.ts';
import type { ImportType, ParsedImport, ParsedRow } from './types.ts';

export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 100_000;

function asString(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function validateHeaders(headers: string[]) {
  if (!headers.length || headers.every((header) => !header.trim())) throw new Error('헤더가 없는 파일입니다.');
  if (headers.some((header) => !header.trim())) throw new Error('빈 컬럼명이 포함되어 있습니다.');
  if (new Set(headers.map((header) => header.trim().toLowerCase())).size !== headers.length) throw new Error('중복 컬럼명이 포함되어 있습니다.');
}

function validateRowLimit(rows: unknown[]) {
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`최대 ${MAX_IMPORT_ROWS.toLocaleString()}행까지 업로드할 수 있습니다.`);
}

async function parseCsv(file: File): Promise<ParsedImport> {
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (result.errors.length) throw new Error(`CSV 파싱에 실패했습니다: ${result.errors[0].message}`);
  const headers = result.meta.fields ?? [];
  validateHeaders(headers);
  validateRowLimit(result.data);
  const rows: ParsedRow[] = result.data.map((row, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header) => [header, asString(row[header])])),
  }));
  return { headers, rows, sourceFormat: 'CSV' };
}

async function parseXlsx(file: File): Promise<ParsedImport> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('Excel 시트가 없습니다.');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: false, blankrows: false });
  if (!matrix.length) throw new Error('데이터가 없는 Excel 파일입니다.');
  const headers = (matrix[0] ?? []).map(asString);
  validateHeaders(headers);
  const dataRows = matrix.slice(1);
  validateRowLimit(dataRows);
  const rows: ParsedRow[] = dataRows.map((row, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, columnIndex) => [header, asString(row[columnIndex])])),
  }));
  return { headers, rows, sourceFormat: 'XLSX' };
}

export async function parseImportFile(file: File, type: ImportType): Promise<ParsedImport> {
  getImportSchema(type);
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error(`파일은 ${MAX_IMPORT_FILE_BYTES / 1024 / 1024}MB 이하만 업로드할 수 있습니다.`);
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(file);
  if (name.endsWith('.xlsx')) return parseXlsx(file);
  throw new Error('지원하지 않는 파일 형식입니다. CSV 또는 XLSX만 업로드할 수 있습니다.');
}
