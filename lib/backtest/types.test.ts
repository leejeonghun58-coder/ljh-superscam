import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMetric } from './types.ts';

test('계산 불가 metric은 null로 표시한다', () => {
  assert.equal(formatMetric(null), null);
  assert.equal(formatMetric(0, true), '0.0%');
});

