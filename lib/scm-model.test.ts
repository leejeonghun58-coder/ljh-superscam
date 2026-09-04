import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBomRequirement, normalizeDemandProfileRt, normalizeOlAccuracy, normalizeShipmentTrend, normalizeLeadtimeGap, normalizeStockoutKpi, normalizeStockoutRisk } from './scm-model.ts';

test('normalizes shipment trend including the live sample values', () => { const result = normalizeShipmentTrend({ item_code: '602K02693', period: '2026-08', shipment_qty: 40, ma_3m: 779, ma_6m: 772.3 }); assert.equal(result.itemCode, '602K02693'); assert.equal(result.shipmentQty, 40); assert.equal(result.average3m, 779); assert.equal(result.average6m, 772.3); assert.equal(result.average12m, null); });
test('preserves demand profile null values and reason code', () => { assert.deepEqual(normalizeDemandProfileRt({ item_id: 'ITEM020', item_name: 'Unknown', adi: null, cv_squared: null, demand_type: null, reason_code: 'NO_DEMAND' }), { itemCode: 'ITEM020', itemName: 'Unknown', adi: null, cvSquared: null, demandType: null, reasonCode: 'NO_DEMAND' }); });
test('normalizes monthly and fiscal-year OL accuracy rows', () => { assert.deepEqual(normalizeOlAccuracy({ model_base: 'MA_3M', item_code: 'ITEM001', period: '2026-08', fy: 'FY2026', wape: 0.12, bias: -2.5 }), { modelBase: 'MA_3M', itemCode: 'ITEM001', itemName: null, period: '2026-08', fiscalYear: 'FY2026', wape: 0.12, bias: -2.5, actualQty: null, forecastQty: null }); });
test('normalizes BOM requirement rows without replacing missing values', () => { assert.deepEqual(normalizeBomRequirement({ model_base: 'MA_3M', item_code: 'ITEM001', part_code: 'PART001', required_qty: null, reason_code: 'NO_BOM' }), { modelBase: 'MA_3M', itemCode: 'ITEM001', itemName: null, partCode: 'PART001', partName: null, requiredQty: null, unit: null, reasonCode: 'NO_BOM' }); });

test('normalizes analytics leadtime rows into the screen model', () => {
  const result = normalizeLeadtimeGap({
    supplier_name: 'Fujifilm BI India',
    country: 'India',
    master_lt: 32,
    sample_count: 159,
    actual_avg: 37.6,
    p80: 44,
    gap: 12,
  });

  assert.deepEqual(result, {
    supplier: 'Fujifilm BI India',
    country: 'India',
    masterLeadTime: 32,
    sampleCount: 159,
    actualAverage: 37.6,
    p80: 44,
    gap: 12,
  });
});

test('uses Korean view aliases and safe defaults', () => {
  const result = normalizeLeadtimeGap({ 법인: 'Japan', 국가: 'Japan', 표준리드타임: 7, 표본수: 278, 실적평균: 14.5, P80: 18, 격차: 11 });
  assert.equal(result.supplier, 'Japan');
  assert.equal(result.masterLeadTime, 7);
  assert.equal(result.p80, 18);
  assert.equal(result.gap, 11);
});

test('reads the real analytics.v_leadtime_gap column names', () => {
  const result = normalizeLeadtimeGap({
    supplier_name: 'Fujifilm BI China',
    country: 'China',
    std_lead_time: 25,
    n_samples: 210,
    mean_days: 28.4,
    p80_days: 33,
    gap_days: 8,
  });

  assert.deepEqual(result, {
    supplier: 'Fujifilm BI China',
    country: 'China',
    masterLeadTime: 25,
    sampleCount: 210,
    actualAverage: 28.4,
    p80: 33,
    gap: 8,
  });
});

test('normalizes analytics stockout risk rows into the screen model', () => {
  const result = normalizeStockoutRisk({
    item_id: 'ITEM012',
    item_name: 'Transfer Belt',
    supplier_id: 'SUP003',
    current_stock: 723,
    inbound_qty: 361,
    available_qty: 1084,
    daily_usage_avg: 60.22,
    cv: 0.34,
    planned_lead_time: 18,
    stockout_days: 18,
    stockout_date: '2026-09-14',
    risk_status: 'CRITICAL',
    reason: null,
  });

  assert.deepEqual(result, {
    itemId: 'ITEM012',
    itemName: 'Transfer Belt',
    supplierId: 'SUP003',
    currentStock: 723,
    inboundQty: 361,
    availableQty: 1084,
    dailyUsageAvg: 60.22,
    cv: 0.34,
    plannedLeadTime: 18,
    stockoutDays: 18,
    stockoutDate: '2026-09-14',
    riskStatus: 'CRITICAL',
    reason: null,
  });
});

test('preserves stockout calculation-unavailable reasons as null values', () => {
  const result = normalizeStockoutRisk({
    item_id: 'ITEM020',
    item_name: 'Unknown Part',
    supplier_id: 'SUP013',
    available_qty: 42,
    daily_usage_avg: null,
    planned_lead_time: null,
    stockout_days: null,
    stockout_date: null,
    risk_status: 'UNKNOWN',
    reason: 'NO_USAGE',
  });

  assert.equal(result.itemId, 'ITEM020');
  assert.equal(result.currentStock, null);
  assert.equal(result.stockoutDays, null);
  assert.equal(result.riskStatus, 'UNKNOWN');
  assert.equal(result.reason, 'NO_USAGE');
});

test('normalizes the stockout KPI summary row', () => {
  const result = normalizeStockoutKpi({
    n_items: 20,
    n_critical: 4,
    n_safe: 13,
    n_unknown: 3,
    n_within_30d: 6,
    avg_stockout_days: 74.5,
  });

  assert.deepEqual(result, {
    itemCount: 20,
    criticalCount: 4,
    safeCount: 13,
    unknownCount: 3,
    within30DaysCount: 6,
    averageStockoutDays: 74.5,
  });
});




