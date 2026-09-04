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


async function readAnalyticsRows<T>(view: string, normalize: (row: Record<string, unknown>) => T, filterColumn: string, filterValue?: string): Promise<{ rows: T[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); let query = supabase.schema('analytics').from(view).select('*'); if (filterValue) query = query.eq(filterColumn, filterValue); const { data, error } = await query; if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalize(row as Record<string, unknown>)), error: null }; } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}
export function getShipmentTrend(itemCode?: string): Promise<{ rows: ShipmentTrend[]; error: string | null }> { return readAnalyticsRows('v_shipment_trend', normalizeShipmentTrend, 'item_code', itemCode); }
export function getDemandProfileRt(itemCode?: string): Promise<{ rows: DemandProfileRt[]; error: string | null }> { return readAnalyticsRows('v_item_demand_profile', normalizeDemandProfileRt, 'item_code', itemCode); }
export async function getOlAccuracy(modelBase?: string): Promise<{ rows: OlAccuracy[]; fyRows: OlAccuracy[]; error: string | null }> { const [monthly, yearly] = await Promise.all([readAnalyticsRows('v_ol_accuracy', normalizeOlAccuracy, 'model_base', modelBase), readAnalyticsRows('v_ol_accuracy_fy', normalizeOlAccuracy, 'model_base', modelBase)]); return { rows: monthly.rows, fyRows: yearly.rows, error: monthly.error ?? yearly.error }; }
export function getBomRequirement(modelBase: string): Promise<{ rows: BomRequirement[]; error: string | null }> { return readAnalyticsRows('v_bom_requirement_x', normalizeBomRequirement, 'model_base', modelBase); }
