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

test('파일 내부 중복과 허용되지 않은 음수를 ERROR로 남긴다', () => {
  const result = validateRows({ type: 'inventory', rows: [
    { rowNumber: 2, values: { item_id: 'ITEM001', warehouse: 'WH01', current_stock: '-2', as_of_date: '2026-08-01' } },
    { rowNumber: 3, values: { item_id: 'ITEM001', warehouse: 'WH01', current_stock: '3', as_of_date: '2026-08-01' } },
  ], itemIds: new Set(['ITEM001']) });
  assert.deepEqual(result.errors.map((error) => error.errorCode).sort(), ['DUPLICATE_KEY', 'NEGATIVE_NOT_ALLOWED']);
});

test('납기일이 발주일보다 빠르면 논리 오류다', () => {
  const result = validateRows({ type: 'purchase_order', rows: [{ rowNumber: 2, values: { po_id: 'PO1', order_date: '2026-08-10', item_id: 'ITEM001', qty: '2', due_date: '2026-08-01' } }], itemIds: new Set(['ITEM001']) });
  assert.equal(result.errors[0].errorCode, 'DATE_ORDER_INVALID');
});
