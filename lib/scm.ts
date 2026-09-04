import { createSupabaseServerClient } from './supabase';
import {
  normalizeLeadtimeGap,
  normalizeStockoutKpi,
  normalizeStockoutRisk,
  type LeadtimeGap,
  type StockoutKpi,
  type StockoutRisk,
  type DemandProfile,
  normalizeDemandProfile,
  type ForecastModelConfig,
  type ForecastRun,
  normalizeForecastModelConfig,
  normalizeForecastRun,
  normalizeShipmentTrend, normalizeDemandProfileRt, normalizeOlAccuracy, normalizeBomRequirement,
  type ShipmentTrend, type DemandProfileRt, type OlAccuracy, type BomRequirement,
} from './scm-model';

export async function getForecastModels(): Promise<{ rows: ForecastModelConfig[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_model_config').select('*').order('model_id');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeForecastModelConfig(row as Record<string, unknown>)), error: null };
  } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Forecast 모델을 조회하지 못했습니다.' }; }
}

export async function getForecastRuns(): Promise<{ rows: ForecastRun[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_forecast_run').select('*').order('started_at', { ascending: false }).limit(50);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeForecastRun(row as Record<string, unknown>)), error: null };
  } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Forecast 실행 이력을 조회하지 못했습니다.' }; }
}

export async function getModelComparison() {
  const supabase = await createSupabaseServerClient();
  const [detail, performance, champions, runs] = await Promise.all([
    supabase.schema('analytics').from('v_model_comparison_detail').select('*').order('period'),
    supabase.schema('analytics').from('v_model_performance').select('*').order('item_id'),
    supabase.schema('analytics').from('v_champion_model').select('*'),
    supabase.schema('analytics').from('v_backtest_run').select('*').order('started_at', { ascending: false }),
  ]);
  const error = detail.error ?? performance.error ?? champions.error ?? runs.error;
  return { detail: (detail.data ?? []) as Record<string, unknown>[], performance: (performance.data ?? []) as Record<string, unknown>[], champions: (champions.data ?? []) as Record<string, unknown>[], runs: (runs.data ?? []) as Record<string, unknown>[], error: error?.message ?? null };
}

export async function getDemandProfiles(): Promise<{ rows: DemandProfile[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_sku_demand_profile').select('*').order('item_id');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeDemandProfile(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getLeadtimeGap(): Promise<{ rows: LeadtimeGap[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_leadtime_gap').select('*');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeLeadtimeGap(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutKpi() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_stockout_kpi').select('*').maybeSingle();
    if (error) return { data: null, error: error.message };
    return {
      data: data ? normalizeStockoutKpi(data as Record<string, unknown>) : null,
      error: null,
    };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutRisks(): Promise<{ rows: StockoutRisk[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('analytics')
      .from('v_stockout_risk')
      .select('*')
      .order('stockout_days', { ascending: true, nullsFirst: false });

    if (error) return { rows: [], error: error.message };

    return {
      rows: (data ?? []).map((row) => normalizeStockoutRisk(row as Record<string, unknown>)),
      error: null,
    };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}



async function readAgentRows(schema: string, view: string, filterColumn: string, filterValue: string): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema(schema).from(view).select('*').eq(filterColumn, filterValue); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []) as Record<string, unknown>[], error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}

export async function getShipmentTrend(itemCode: string) { const { normalizeAgentShipmentTrend } = await import('./scm-model'); const result = await readAgentRows('analytics', 'v_shipment_by_hoc', 'item_code', itemCode); return { rows: result.rows.map(normalizeAgentShipmentTrend), error: result.error }; }

export async function getDemandProfile(itemCode: string) { const { normalizeAgentDemandProfile } = await import('./scm-model'); const result = await readAgentRows('core', 'fact_shipment', 'item_code', itemCode); return { rows: result.rows.map(normalizeAgentDemandProfile), error: result.error }; }

export async function getOlAccuracy(modelBase: string, fy?: string) { const { normalizeAgentOlAccuracy } = await import('./scm-model'); const monthly = await readAgentRows('core', 'fact_mc_plan_actual', 'model_base', modelBase); const rows = fy ? monthly.rows.filter((row) => String(row.fy ?? row.fiscal_year ?? '') === fy) : monthly.rows; return { rows: rows.map(normalizeAgentOlAccuracy), fyRows: [], error: monthly.error }; }

export async function getBomRequirement(modelBase: string) { const { normalizeAgentBomRequirement } = await import('./scm-model'); const result = await readAgentRows('analytics', 'v_bom_requirement_x', 'model_base', modelBase); return { rows: result.rows.map(normalizeAgentBomRequirement), error: result.error }; }
