import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPORT_SCHEMAS, suggestColumnMapping } from './schema.ts';

test('지원 import type은 실제 raw 테이블 8개로 제한한다', () => {
  assert.deepEqual(Object.keys(IMPORT_SCHEMAS).sort(), [
    'business_event', 'goods_receipt', 'inventory', 'item_master',
    'purchase_order', 'sales_order', 'supplier_master', 'usage_history',
  ]);
});

test('한국어 alias에서 usage_history 표준 컬럼을 추정한다', () => {
  assert.deepEqual(suggestColumnMapping('usage_history', ['품목코드', '출고일', '출고수량']).map((x) => x.targetColumn), ['item_id', 'use_date', 'qty']);
});
