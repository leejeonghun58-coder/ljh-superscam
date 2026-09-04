-- STEP 7: Backtest, Model Performance, Champion Model
-- Scoring은 STEP 6 forecast_result와 STEP 3 v_test_actual의 조합만 사용합니다.

alter table core.forecast_setting
  add column if not exists champion_metric text not null default 'WAPE',
  add column if not exists reference_model_id text not null default 'MA_3M';

alter table core.forecast_setting drop constraint if exists forecast_setting_champion_metric_check;
alter table core.forecast_setting add constraint forecast_setting_champion_metric_check
  check (champion_metric in ('WAPE','MAPE','RMSE','MAE'));

create table if not exists core.backtest_run (
  backtest_run_id uuid primary key default gen_random_uuid(),
  forecast_run_id uuid not null references core.forecast_run(run_id),
  test_start date not null,
  test_end date not null,
  metric text not null default 'WAPE',
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCESS','FAILED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by uuid references auth.users(id) on delete set null,
  message text,
  check (test_start <= test_end)
);

create table if not exists core.model_performance (
  backtest_run_id uuid not null references core.backtest_run(backtest_run_id) on delete cascade,
  forecast_run_id uuid not null references core.forecast_run(run_id) on delete cascade,
  model_id text not null,
  model_version uuid not null references core.model_version(model_version_id),
  item_id text not null,
  n_periods integer not null default 0,
  wape numeric,
  mape numeric,
  bias numeric,
  rmse numeric,
  mae numeric,
  baseline_improvement numeric,
  rank integer,
  calculation_status text not null default 'SUCCESS' check (calculation_status in ('SUCCESS','UNAVAILABLE')),
  reason_code text,
  calculated_at timestamptz not null default now(),
  primary key (backtest_run_id, model_id, item_id)
);

create table if not exists core.champion_model (
  champion_id uuid primary key default gen_random_uuid(),
  backtest_run_id uuid not null references core.backtest_run(backtest_run_id),
  item_id text not null,
  champion_model_id text not null,
  model_version uuid not null references core.model_version(model_version_id),
  champion_metric text not null,
  champion_metric_value numeric,
  wape numeric,
  mape numeric,
  bias numeric,
  rmse numeric,
  mae numeric,
  candidate_performance jsonb not null default '[]'::jsonb,
  selection_reason text not null,
  selection_method text not null check (selection_method in ('AUTO','MANUAL')),
  selected_at timestamptz not null default now(),
  selected_by uuid references auth.users(id) on delete set null
);

create index if not exists model_performance_lookup_idx on core.model_performance(backtest_run_id, item_id, rank);
create index if not exists champion_lookup_idx on core.champion_model(backtest_run_id, item_id, selected_at desc);

alter table core.backtest_run enable row level security;
alter table core.model_performance enable row level security;
alter table core.champion_model enable row level security;

drop policy if exists step7_backtest_admin on core.backtest_run;
create policy step7_backtest_admin on core.backtest_run for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists step7_performance_read on core.model_performance;
create policy step7_performance_read on core.model_performance for select to authenticated using (auth.uid() is not null);
drop policy if exists step7_champion_read on core.champion_model;
create policy step7_champion_read on core.champion_model for select to authenticated using (auth.uid() is not null);
drop policy if exists step7_champion_admin on core.champion_model;
create policy step7_champion_admin on core.champion_model for all to authenticated using (core.is_admin()) with check (core.is_admin());

revoke all on core.backtest_run, core.model_performance, core.champion_model from anon;
revoke insert, update, delete on core.backtest_run, core.model_performance, core.champion_model from authenticated;
grant select on core.backtest_run, core.model_performance, core.champion_model to authenticated;

create or replace function core.run_backtest(p_forecast_run_id uuid)
returns uuid
language plpgsql security definer
set search_path = core, analytics, public
as $$
declare
  v_bt uuid;
  v_test_start date;
  v_test_end date;
  v_metric text;
  v_reference text;
  v_user uuid := auth.uid();
begin
  if not core.is_admin() then raise exception '관리자만 Backtest를 실행할 수 있습니다'; end if;
  if not exists (select 1 from core.forecast_run where run_id = p_forecast_run_id and status = 'SUCCESS') then
    raise exception 'SUCCESS 상태의 Forecast Run만 Backtest할 수 있습니다';
  end if;
  select test_start, test_end, champion_metric, reference_model_id
    into v_test_start, v_test_end, v_metric, v_reference
  from core.forecast_setting where setting_id = 'default';
  if v_test_start is null or v_test_end is null then raise exception '검증기간이 설정되지 않았습니다'; end if;
  v_metric := coalesce(v_metric, 'WAPE');
  insert into core.backtest_run(forecast_run_id, test_start, test_end, metric, triggered_by)
  values (p_forecast_run_id, v_test_start, v_test_end, v_metric, v_user)
  returning backtest_run_id into v_bt;

  with actual as (
    select upper(regexp_replace(item_id, '[\s\-_]', '', 'g')) item_id,
           actual_date::date period, sum(qty)::numeric actual
    from core.v_test_actual
    where actual_date between v_test_start and v_test_end
    group by 1,2
  ), forecast as (
    select f.model_id, f.model_version, upper(regexp_replace(f.item_id, '[\s\-_]', '', 'g')) item_id,
           f.period, f.p50 forecast
    from core.forecast_result f
    where f.run_id = p_forecast_run_id and f.period between v_test_start and v_test_end
  ), joined as (
    select coalesce(f.model_id, 'UNKNOWN') model_id, f.model_version, coalesce(f.item_id, a.item_id) item_id,
           a.period, a.actual, f.forecast
    from forecast f left join actual a using (item_id, period)
  ), stats as (
    select model_id, (array_agg(model_version))[1] model_version, item_id, count(*) filter (where actual is not null and forecast is not null)::int n_periods,
      case when sum(abs(actual)) filter (where actual is not null and forecast is not null) > 0
        then sum(abs(actual - forecast)) filter (where actual is not null and forecast is not null) / sum(abs(actual)) filter (where actual is not null and forecast is not null) end wape,
      case when count(*) filter (where actual is not null and forecast is not null and actual <> 0) > 0
        then avg(abs(actual - forecast) / nullif(abs(actual),0)) filter (where actual is not null and forecast is not null and actual <> 0) end mape,
      case when count(*) filter (where actual is not null and forecast is not null) > 0
        then avg(forecast - actual) filter (where actual is not null and forecast is not null) end bias,
      case when count(*) filter (where actual is not null and forecast is not null) > 0
        then sqrt(avg((forecast - actual)^2) filter (where actual is not null and forecast is not null)) end rmse,
      case when count(*) filter (where actual is not null and forecast is not null) > 0
        then avg(abs(forecast - actual)) filter (where actual is not null and forecast is not null) end mae,
      case when count(*) filter (where actual is not null and forecast is not null) = 0 then 'NO_COMPARABLE_PERIODS'
           when count(*) filter (where actual is null) > 0 then 'ACTUAL_MISSING'
           when count(*) filter (where forecast is null) > 0 then 'FORECAST_MISSING'
           when sum(abs(actual)) filter (where actual is not null and forecast is not null) = 0 then 'ACTUAL_SUM_ZERO'
           else null end reason_code
    from joined group by model_id, item_id
  ), scored as (
    select s.*, ref.wape ref_wape,
      case when (case v_metric when 'WAPE' then s.wape when 'MAPE' then s.mape when 'RMSE' then s.rmse when 'MAE' then s.mae end) is not null and (case v_metric when 'WAPE' then ref.wape when 'MAPE' then ref.mape when 'RMSE' then ref.rmse when 'MAE' then ref.mae end) is not null and (case v_metric when 'WAPE' then ref.wape when 'MAPE' then ref.mape when 'RMSE' then ref.rmse when 'MAE' then ref.mae end) <> 0 then ((case v_metric when 'WAPE' then ref.wape when 'MAPE' then ref.mape when 'RMSE' then ref.rmse when 'MAE' then ref.mae end) - (case v_metric when 'WAPE' then s.wape when 'MAPE' then s.mape when 'RMSE' then s.rmse when 'MAE' then s.mae end)) / (case v_metric when 'WAPE' then ref.wape when 'MAPE' then ref.mape when 'RMSE' then ref.rmse when 'MAE' then ref.mae end) end baseline_improvement,
      case when (case v_metric when 'WAPE' then s.wape when 'MAPE' then s.mape when 'RMSE' then s.rmse when 'MAE' then s.mae end) is not null then row_number() over (partition by s.item_id order by (case v_metric when 'WAPE' then s.wape when 'MAPE' then s.mape when 'RMSE' then s.rmse when 'MAE' then s.mae end) asc nulls last, abs(coalesce(s.bias, 1e99)) asc, s.rmse asc nulls last, s.model_id) end rank_value
    from stats s left join stats ref on ref.item_id=s.item_id and ref.model_id=v_reference
  )
  insert into core.model_performance(backtest_run_id, forecast_run_id, model_id, model_version, item_id, n_periods, wape, mape, bias, rmse, mae, baseline_improvement, rank, calculation_status, reason_code)
  select v_bt, p_forecast_run_id, model_id, model_version, item_id, n_periods, wape, mape, bias, rmse, mae, baseline_improvement, rank_value::int,
    case when rank_value is null then 'UNAVAILABLE' else 'SUCCESS' end, reason_code from scored;

  with candidates as (
    select p.*, row_number() over (partition by item_id order by rank) pick
    from core.model_performance p where p.backtest_run_id=v_bt and p.rank is not null
  ), all_candidates as (
    select item_id, jsonb_agg(jsonb_build_object('model_id',model_id,'model_version',model_version,'wape',wape,'mape',mape,'bias',bias,'rmse',rmse,'mae',mae,'rank',rank) order by rank nulls last, model_id) data
    from core.model_performance where backtest_run_id=v_bt group by item_id
  )
  insert into core.champion_model(backtest_run_id,item_id,champion_model_id,model_version,champion_metric,champion_metric_value,wape,mape,bias,rmse,mae,candidate_performance,selection_reason,selection_method,selected_by)
  select v_bt,c.item_id,c.model_id,c.model_version,v_metric,
    case v_metric when 'WAPE' then c.wape when 'MAPE' then c.mape when 'RMSE' then c.rmse when 'MAE' then c.mae end,
    c.wape,c.mape,c.bias,c.rmse,c.mae,a.data,'AUTO: 설정된 champion_metric 기준 최저값; tie-break는 absolute Bias, RMSE, model_id 순','AUTO',v_user
  from candidates c join all_candidates a using(item_id) where c.pick=1;
  update core.backtest_run set status='SUCCESS', finished_at=now(), message='Forecast Result와 검증 Actual의 저장 결과를 비교했습니다.' where backtest_run_id=v_bt;
  return v_bt;
exception when others then
  if v_bt is not null then update core.backtest_run set status='FAILED', finished_at=now(), message=sqlerrm where backtest_run_id=v_bt; end if;
  raise;
end;
$$;

create or replace function core.set_manual_champion(p_backtest_run_id uuid, p_item_id text, p_model_id text, p_reason text)
returns uuid language plpgsql security definer set search_path = core, public as $$
declare v_id uuid; v_old jsonb; v_perf core.model_performance%rowtype; begin
  if not core.is_admin() then raise exception '관리자만 Champion을 변경할 수 있습니다'; end if;
  if nullif(trim(p_reason),'') is null then raise exception '수동 Champion 지정 사유는 필수입니다'; end if;
  select to_jsonb(c) into v_old from core.champion_model c where c.backtest_run_id=p_backtest_run_id and c.item_id=p_item_id and c.selection_method='AUTO' order by selected_at desc limit 1;
  select * into v_perf from core.model_performance where backtest_run_id=p_backtest_run_id and item_id=p_item_id and model_id=p_model_id order by calculated_at desc limit 1;
  if v_perf.model_version is null then raise exception '해당 SKU/모델의 성능 결과가 없습니다'; end if;
  insert into core.champion_model(backtest_run_id,item_id,champion_model_id,model_version,champion_metric,champion_metric_value,wape,mape,bias,rmse,mae,candidate_performance,selection_reason,selection_method,selected_by)
  values(p_backtest_run_id,p_item_id,p_model_id,v_perf.model_version,(select metric from core.backtest_run where backtest_run_id=p_backtest_run_id),case (select metric from core.backtest_run where backtest_run_id=p_backtest_run_id) when 'WAPE' then v_perf.wape when 'MAPE' then v_perf.mape when 'RMSE' then v_perf.rmse when 'MAE' then v_perf.mae end,v_perf.wape,v_perf.mape,v_perf.bias,v_perf.rmse,v_perf.mae,(select coalesce(jsonb_agg(to_jsonb(x) order by x.rank),'[]'::jsonb) from core.model_performance x where x.backtest_run_id=p_backtest_run_id and x.item_id=p_item_id),p_reason,'MANUAL',auth.uid()) returning champion_id into v_id;
  insert into core.audit_log(actor,action,target_type,target_id,before,after) values(auth.uid(),'MANUAL_CHAMPION_SELECTED','champion_model',p_item_id,v_old,jsonb_build_object('champion_id',v_id,'model_id',p_model_id,'reason',p_reason));
  return v_id;
end; $$;

revoke all on function core.run_backtest(uuid), core.set_manual_champion(uuid,text,text,text) from public;
grant execute on function core.run_backtest(uuid), core.set_manual_champion(uuid,text,text,text) to authenticated;

create or replace view analytics.v_model_performance as select p.*, m.model_name from core.model_performance p left join core.model_config m using (model_id);
create or replace view analytics.v_champion_model as select * from core.champion_model;
create or replace view analytics.v_backtest_run as select * from core.backtest_run;
grant select on analytics.v_model_performance, analytics.v_champion_model, analytics.v_backtest_run to authenticated;
revoke all on analytics.v_model_performance, analytics.v_champion_model, analytics.v_backtest_run from anon;


create or replace view analytics.v_backtest_detail as
with actual as (
  select upper(regexp_replace(item_id, '[\s\-_]', '', 'g')) item_id,
         date_trunc('month', actual_date)::date period, sum(qty)::numeric actual
  from core.v_test_actual group by 1, 2
)
select b.backtest_run_id, b.forecast_run_id, f.model_id, f.item_id, f.period,
       a.actual, f.p50, f.p80, f.p90, f.sigma, f.reason_code
from core.backtest_run b
join core.forecast_result f on f.run_id = b.forecast_run_id
left join actual a on a.item_id = upper(regexp_replace(f.item_id, '[\s\-_]', '', 'g')) and a.period = date_trunc('month', f.period)::date
where f.period between b.test_start and b.test_end;
grant select on analytics.v_backtest_detail to authenticated;
revoke all on analytics.v_backtest_detail from anon;

comment on table core.model_performance is 'WAPE=SUM(abs(actual-forecast))/SUM(abs(actual)); MAPE excludes actual=0 periods; Bias=forecast-actual, positive means over-forecast. Unavailable metrics remain NULL with reason_code.';



