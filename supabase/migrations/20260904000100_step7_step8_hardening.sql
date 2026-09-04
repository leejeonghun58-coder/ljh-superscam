-- STEP 7/8 보정: 기존 migration을 덮어쓰지 않고 analytics 계약과 권한을 보강합니다.
-- Backtest는 저장된 Forecast Result와 core.v_test_actual만 읽습니다.

create or replace view analytics.v_backtest_run_kpi
with (security_invoker = true)
as
select
  r.backtest_run_id,
  r.forecast_run_id,
  r.status,
  r.metric,
  r.test_start,
  r.test_end,
  r.started_at,
  r.finished_at,
  count(p.*)::int as performance_rows,
  count(*) filter (where p.calculation_status = 'SUCCESS')::int as available_rows,
  count(*) filter (where p.calculation_status <> 'SUCCESS')::int as unavailable_rows,
  count(distinct p.item_id)::int as items,
  count(distinct p.model_id)::int as models
from core.backtest_run r
left join core.model_performance p using (backtest_run_id)
group by r.backtest_run_id, r.forecast_run_id, r.status, r.metric,
  r.test_start, r.test_end, r.started_at, r.finished_at;

create or replace view analytics.v_model_comparison_detail
with (security_invoker = true)
as
with actual as (
  select item_id, date_trunc('month', use_date)::date as period, sum(qty)::numeric as actual_qty
  from core.v_test_actual
  group by item_id, date_trunc('month', use_date)::date
)
select
  b.backtest_run_id,
  b.forecast_run_id,
  f.model_id,
  f.model_version,
  f.item_id,
  f.period,
  a.actual_qty,
  f.predicted_qty,
  f.p50,
  f.p80,
  f.p90,
  f.sigma,
  f.reason_code
from core.backtest_run b
join core.forecast_result f
  on f.run_id = b.forecast_run_id
 and f.period between b.test_start and b.test_end
left join actual a
  on a.item_id = f.item_id
 and a.period = date_trunc('month', f.period)::date;

-- Bias = Forecast - Actual. 양수는 과대예측, 음수는 과소예측입니다.
comment on view analytics.v_model_comparison_detail is
  'Model Comparison은 저장된 forecast_result와 검증 전용 v_test_actual만 조회한다. 계산은 SQL Backtest가 수행한다.';
comment on view analytics.v_backtest_run_kpi is
  'Backtest 실행별 성능 행·SKU·모델 및 계산 가능/불가 건수 요약.';

grant select on analytics.v_backtest_run_kpi, analytics.v_model_comparison_detail to authenticated;
revoke all on analytics.v_backtest_run_kpi, analytics.v_model_comparison_detail from anon;

-- 수동 Champion도 해당 Backtest의 선택 metric을 그대로 보존합니다.
create or replace function core.select_manual_champion(
  p_backtest_run_id uuid,
  p_item_id text,
  p_model_id text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = core, pg_temp
as $$
declare
  v_perf core.model_performance%rowtype;
  v_metric text;
  v_id uuid := gen_random_uuid();
begin
  if not core.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception '수동 Champion 변경 사유는 필수입니다.' using errcode = '22023';
  end if;
  select metric into v_metric from core.backtest_run where backtest_run_id = p_backtest_run_id;
  if v_metric is null then
    raise exception 'Backtest Run을 찾을 수 없습니다.' using errcode = '22023';
  end if;
  select * into v_perf
  from core.model_performance
  where backtest_run_id = p_backtest_run_id
    and item_id = p_item_id
    and model_id = p_model_id;
  if not found or v_perf.calculation_status <> 'SUCCESS' then
    raise exception '계산 가능한 후보 성능이 없습니다.' using errcode = '22023';
  end if;
  insert into core.champion_model_selection(
    selection_id, backtest_run_id, item_id, champion_model_id, model_version,
    champion_metric, champion_metric_value, wape, mape, bias, rmse, mae,
    candidate_performance, selection_reason, selection_method, selected_by
  )
  values (
    v_id, p_backtest_run_id, p_item_id, p_model_id, v_perf.model_version,
    v_metric,
    case v_metric when 'WAPE' then v_perf.wape when 'MAPE' then v_perf.mape
      when 'RMSE' then v_perf.rmse when 'MAE' then v_perf.mae end,
    v_perf.wape, v_perf.mape, v_perf.bias, v_perf.rmse, v_perf.mae,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'model_id', model_id, 'model_version', model_version, 'wape', wape,
      'mape', mape, 'bias', bias, 'rmse', rmse, 'mae', mae, 'rank', rank,
      'reason_code', reason_code
    ) order by rank nulls last, model_id), '[]'::jsonb)
     from core.model_performance where backtest_run_id = p_backtest_run_id and item_id = p_item_id),
    p_reason, 'MANUAL', auth.uid()
  );
  insert into core.audit_log(actor, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'CHAMPION_MANUALLY_CHANGED', 'champion_model', p_item_id,
    (select to_jsonb(c) from core.champion_model_selection c
     where c.backtest_run_id = p_backtest_run_id and c.item_id = p_item_id
     and c.selection_id <> v_id order by c.selected_at desc limit 1),
    jsonb_build_object('selection_id', v_id, 'backtest_run_id', p_backtest_run_id,
      'model_id', p_model_id, 'reason', p_reason)
  );
  return v_id;
end;
$$;

revoke all on function core.select_manual_champion(uuid, text, text, text) from public;
grant execute on function core.select_manual_champion(uuid, text, text, text) to authenticated;

-- STEP 8 Python 모델은 기본 비활성 상태로 등록하고, ADMIN이 DB에서 활성화합니다.
comment on table core.model_config is
  'SQL/PYTHON 모델 registry. enabled, parameters, version은 코드 변경 없이 ADMIN이 관리한다.';
