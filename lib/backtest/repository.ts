import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BacktestDetail, BacktestPerformance } from './types';

function asNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export async function getBacktestPerformances(forecastRunId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.schema('analytics').from('v_model_performance').select('*').order('item_id').order('rank');
  if (forecastRunId) query = query.eq('forecast_run_id', forecastRunId);
  const { data, error } = await query;
  if (error) return { rows: [] as BacktestPerformance[], error: error.message };
  return { rows: (data ?? []).map((row) => ({
    backtestRunId: String(row.backtest_run_id), forecastRunId: String(row.forecast_run_id), modelId: String(row.model_id),
    modelName: row.model_name ? String(row.model_name) : String(row.model_id), modelVersion: String(row.model_version), itemId: String(row.item_id), nPeriods: Number(row.n_periods ?? 0),
    wape: asNumber(row.wape), mape: asNumber(row.mape), bias: asNumber(row.bias), rmse: asNumber(row.rmse), mae: asNumber(row.mae),
    baselineImprovement: asNumber(row.baseline_improvement), rank: row.rank === null ? null : Number(row.rank),
    calculationStatus: row.calculation_status === 'SUCCESS' ? 'SUCCESS' : 'UNAVAILABLE', reasonCode: row.reason_code ? String(row.reason_code) : null,
  })) as BacktestPerformance[], error: null };
}

export async function getBacktestRuns() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('analytics').from('v_backtest_run').select('*').eq('status', 'SUCCESS').order('finished_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getChampions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('analytics').from('v_champion_model').select('backtest_run_id,item_id,champion_model_id,model_version,champion_metric,champion_metric_value,selection_method,selection_reason').order('selected_at', { ascending: false });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getLatestBacktestRun() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('analytics').from('v_backtest_run').select('*').eq('status', 'SUCCESS').order('finished_at', { ascending: false }).limit(1).maybeSingle();
  return { data, error: error?.message ?? null };
}

export async function runBacktest(forecastRunId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').rpc('run_backtest', { p_forecast_run_id: forecastRunId });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function getBacktestDetails(backtestRunId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.schema('analytics').from('v_backtest_detail').select('*').order('period').order('item_id').order('model_id');
  if (backtestRunId) query = query.eq('backtest_run_id', backtestRunId);
  const { data, error } = await query;
  if (error) return { rows: [] as BacktestDetail[], error: error.message };
  return { rows: (data ?? []).map((row) => ({
    backtestRunId: String(row.backtest_run_id), forecastRunId: String(row.forecast_run_id), modelId: String(row.model_id), itemId: String(row.item_id), period: String(row.period),
    actual: asNumber(row.actual), p50: asNumber(row.p50), p80: asNumber(row.p80), p90: asNumber(row.p90), sigma: asNumber(row.sigma), reasonCode: row.reason_code ? String(row.reason_code) : null,
  })) as BacktestDetail[], error: null };
}



