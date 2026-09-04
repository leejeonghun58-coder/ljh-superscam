import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/migrations/20260828000900_step9_leadtime_inventory_projection.sql', import.meta.url), 'utf8');
test('STEP 9 SQL은 Projection의 필수 객체와 상태를 정의한다', () => {
  for (const name of ['core.v_leadtime_effective','core.v_open_po_schedule','core.v_confirmed_sales_order_schedule','core.v_soft_allocation_schedule','analytics.v_inventory_projection','analytics.v_stockout_risk']) assert.match(sql, new RegExp(name.replaceAll('.', '\\.'), 'i'));
  assert.match(sql, /CALCULATION_UNAVAILABLE/);
  assert.match(sql, /NO_INVENTORY_DATA/);
  assert.match(sql, /NO_FORECAST/);
});
test('STEP 9 SQL은 재고·Forecast·Lead Time을 0 또는 30일로 보정하지 않는다', () => {
  assert.doesNotMatch(sql, /coalesce\(st\.current_stock\s*,\s*0\)/i);
  assert.doesNotMatch(sql, /coalesce\(.*effective_lead_time.*30/i);
  assert.match(sql, /ADMIN_CONFIRMED/);
  assert.match(sql, /ACTUAL_P80/);
});
test('STEP 9 Projection은 예정 입고를 기간별로 더하고 수요를 차감한다', () => {
  assert.match(sql, /scheduled_receipt/);
  assert.match(sql, /confirmed_sales_order/);
  assert.match(sql, /soft_allocation/);
  assert.match(sql, /scheduled_receipt,0\) - x\.soft_allocation - x\.confirmed_sales_order - x\.forecast_demand/);
});
