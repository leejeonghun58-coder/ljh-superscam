import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseImportFile } from './parse.ts';

test('CSV 원본값과 행 번호를 보존한다', async () => {
  const result = await parseImportFile(new File(['품목코드,출고일,출고수량\nITEM001,2026-08-01,12'], 'sample.csv'), 'usage_history');
  assert.deepEqual(result.rows[0], { rowNumber: 2, values: { 품목코드: 'ITEM001', 출고일: '2026-08-01', 출고수량: '12' } });
});

test('지원하지 않는 확장자는 거부한다', async () => {
  await assert.rejects(() => parseImportFile(new File(['x'], 'sample.txt'), 'usage_history'), /지원하지 않는 파일/);
});

test('XLSX 셀 값을 문자열로 보존한다', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['usage_id', 'item_id', 'use_date', 'qty'], ['U1', 'ITEM001', '2026-08-01', 12]]), 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const result = await parseImportFile(new File([buffer], 'sample.xlsx'), 'usage_history');
  assert.equal(result.rows[0].values.qty, '12');
  assert.equal(result.sourceFormat, 'XLSX');
});
