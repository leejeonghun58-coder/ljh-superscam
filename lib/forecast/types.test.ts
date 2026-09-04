import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE_MODEL_IDS, type DemandTypeCode } from './types.ts';

test('SQL Baseline 모델 계약은 요구된 5개 코드만 사용한다', () => {
  assert.deepEqual(BASELINE_MODEL_IDS, ['MA_3M', 'MA_6M', 'WMA_3M', 'PY_SAME_MONTH', 'SEASONAL_NAIVE']);
});

test('Demand Type 코드는 STEP 5와 같은 대문자 값이다', () => {
  const codes: DemandTypeCode[] = ['SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY'];
  assert.deepEqual(codes, ['SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY']);
});
