import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRows } from './validate.ts';

test('알 수 없는 품목과 잘못된 날짜를 ERROR로 남긴다', () => {
  const result = validateRows({ type: 'usage_history', rows: [{ rowNumber: 2, values: { usage_id: 'U1', item_id: 'ITEM999', use_date: '2026-99-01', qty: '4' } }], itemIds: new Set(['ITEM001']) });
  assert.deepEqual(result.errors.map((e) => e.errorCode).sort(), ['INVALID_DATE', 'UNKNOWN_ITEM']);
});

test('null 수량을 0으로 바꾸지 않는다', () => {
  const result = validateRows({ type: 'usage_history', rows: [{ rowNumber: 2, values: { usage_id: 'U1', item_id: 'ITEM001', use_date: '2026-08-01', qty: '' } }], itemIds: new Set(['ITEM001']) });
  assert.equal(result.rows[0].values.qty, '');
  assert.equal(result.errors[0].errorCode, 'REQUIRED_VALUE_MISSING');
});
