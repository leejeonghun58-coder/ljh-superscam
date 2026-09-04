import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ForecastModel, ForecastRun } from './types';

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function getForecastModels(): Promise<{ rows: ForecastModel[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_model_config').select('*').order('model_id');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => ({
      modelId: String(row.model_id), modelName: String(row.model_name), family: String(row.family), engine: String(row.engine),
      version: String(row.version), enabled: Boolean(row.enabled), isDefault: Boolean(row.is_default),
      applicableDemandType: Array.isArray(row.applicable_demand_type) ? row.applicable_demand_type.map(String) as ForecastModel['applicableDemandType'] : [],
      parameters: (row.parameters ?? {}) as Record<string, unknown>, description: row.description ? String(row.description) : null,
    })), error: null };
  } catch (error) { return { rows: [], error: message(error, '모델 조회에 실패했습니다.') }; }
}

export async function getForecastRuns(): Promise<{ rows: ForecastRun[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_forecast_run').select('*').order('started_at', { ascending: false }).limit(50);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => ({
      runId: String(row.run_id), status: row.status as ForecastRun['status'], granularity: String(row.granularity),
      trainStart: row.train_start ? String(row.train_start) : null, trainEnd: row.train_end ? String(row.train_end) : null,
      horizon: Number(row.horizon), nModels: Number(row.n_models), nItems: Number(row.n_items), nRows: Number(row.n_rows),
      dataSnapshotAt: String(row.data_snapshot_at), startedAt: String(row.started_at), finishedAt: row.finished_at ? String(row.finished_at) : null,
      durationMs: row.duration_ms === null ? null : Number(row.duration_ms), triggeredEmail: row.triggered_email ? String(row.triggered_email) : null,
      isStale: Boolean(row.is_stale), message: row.message ? String(row.message) : null,
    })), error: null };
  } catch (error) { return { rows: [], error: message(error, 'Forecast Run 조회에 실패했습니다.') }; }
}

export async function runBaselineForecast(note?: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').rpc('run_baseline_forecast', { p_note: note || null });
  if (error) throw new Error(error.message);
  return String(data);
}
