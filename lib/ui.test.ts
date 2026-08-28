import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUiValue, formatUnavailable, STATUS_LABELS } from './ui.ts';

test('계산 불가 값은 0이 아니라 사유와 함께 표시한다', () => {
  assert.equal(formatUiValue(null, 'NO_USAGE'), '— + NO_USAGE');
  assert.equal(formatUnavailable('NO_LEADTIME'), '— + NO_LEADTIME');
});

test('SCM 상태 라벨은 공통 상태 체계를 사용한다', () => {
  assert.equal(STATUS_LABELS.SAFE, '안전');
  assert.equal(STATUS_LABELS.WARNING, '주의');
  assert.equal(STATUS_LABELS.CRITICAL, '위험');
  assert.equal(STATUS_LABELS.CALCULATION_UNAVAILABLE, '계산 불가');
});
