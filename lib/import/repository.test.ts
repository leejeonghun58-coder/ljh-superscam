import test from 'node:test';
import assert from 'node:assert/strict';
import { assertImportReady } from './policy.ts';

test('검증 전 또는 ERROR batch는 import 준비 상태가 아니다', () => {
  assert.throws(() => assertImportReady({ status: 'STAGED', error_rows: 0 }), /검증/);
  assert.throws(() => assertImportReady({ status: 'VALIDATED', error_rows: 1 }), /ERROR/);
});

test('ERROR가 없는 검증 완료 batch만 import 준비 상태다', () => {
  assert.doesNotThrow(() => assertImportReady({ status: 'VALIDATED', error_rows: 0 }));
});
