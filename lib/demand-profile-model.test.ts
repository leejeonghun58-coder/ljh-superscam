import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDemandProfile, normalizeDemandProfileKpi } from './scm-model.ts';

test('Demand Profile row를 정규화하고 null을 보존한다', () => {
  const row = normalizeDemandProfile({ item_id: 'ITEM001', item_name: '테스트 품목', n_periods: 24, n_nonzero_periods: 12, adi: 2, cv: 0.8, cv_squared: 0.64, zero_demand_rate: 0.5, trend: null, recent_change_rate: null, peak_period: '2026-01-01', demand_type: 'LUMPY', seasonality: null, reason_code: 'INSUFFICIENT_PERIODS', stability: 'UNAVAILABLE' });
  assert.equal(row.itemId, 'ITEM001');
  assert.equal(row.cvSquared, 0.64);
  assert.equal(row.trend, null);
  assert.equal(row.demandType, 'LUMPY');
  assert.equal(row.seasonality, null);
  assert.equal(row.reasonCode, 'INSUFFICIENT_PERIODS');
});

test('Demand Profile KPI 코드값을 유지한다', () => {
  const kpi = normalizeDemandProfileKpi({ total_items: 20, n_smooth: 5, n_intermittent: 6, n_erratic: 4, n_lumpy: 3, n_croston_needed: 9, n_calculation_unavailable: 2 });
  assert.deepEqual(kpi, { totalItems: 20, nSmooth: 5, nIntermittent: 6, nErratic: 4, nLumpy: 3, nCrostonNeeded: 9, nCalculationUnavailable: 2 });
});
