-- STEP 6: SQL Baseline Forecast Engine
-- Forecast 계산은 core.v_train_demand 기반 월별 Grid만 사용합니다.

alter table core.forecast_setting
  add column if not exists forecast_horizon integer not null default 3;

create table if not exists core.model_config (
  model_id text primary key,
  model_name text not null,
  family text not null,
  engine text not null default 'SQL',
  version text not null,
  enabled boolean not null default true,
  is_default boolean not null default false,
  applicable_demand_type text[] not null default array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'],
  parameters jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists core.model_version (
  model_version_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references core.forecast_run(run_id) on delete cascade,
  model_id text not null,
  version text not null,
  parameters jsonb not null,
  definition text not null,
  snapshotted_at timestamptz not null default now(),
  unique (run_id, model_id)
);

alter table core.forecast_run
  add column if not exists status text not null default 'RUNNING',
  add column if not exists granularity text not null default 'MONTH',
  add column if not exists train_start date,
  add column if not exists train_end date,
  add column if not exists horizon integer not null default 3,
  add column if not exists champion_metric text,
  add column if not exists models jsonb not null default '[]'::jsonb,
  add column if not exists n_models integer not null default 0,
  add column if not exists n_items integer not null default 0,
  add column if not exists n_rows integer not null default 0,
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists finished_at timestamptz,
  add column if not exists duration_ms bigint,
  add column if not exists triggered_by uuid references auth.users(id),
  add column if not exists triggered_email text,
  add column if not exists note text,
  add column if not exists message text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'forecast_run_status_check') then
    alter table core.forecast_run add constraint forecast_run_status_check check (status in ('RUNNING','SUCCESS','FAILED'));
  end if;
end $$;

create table if not exists core.forecast_result (
  run_id uuid not null references core.forecast_run(run_id) on delete cascade,
  model_id text not null,
  model_version uuid not null references core.model_version(model_version_id),
  item_id text not null,
  period date not null,
  predicted_qty numeric,
  p50 numeric,
  p80 numeric,
  p90 numeric,
  sigma numeric,
  basis text,
  reason_code text,
  created_at timestamptz not null default now(),
  primary key (run_id, model_id, item_id, period)
);

create index if not exists forecast_result_run_idx on core.forecast_result(run_id, model_id, item_id, period);
create index if not exists model_version_run_idx on core.model_version(run_id, model_id);
create index if not exists forecast_run_started_idx on core.forecast_run(started_at desc);

insert into core.model_config(model_id, model_name, family, engine, version, enabled, is_default, applicable_demand_type, parameters, description)
values
  ('MA_3M', '3개월 이동평균', 'MOVING_AVERAGE', 'SQL', '1.0.0', true, true, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"window_months":3}'::jsonb, '학습기간 최근 3개월 평균'),
  ('MA_6M', '6개월 이동평균', 'MOVING_AVERAGE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"window_months":6}'::jsonb, '학습기간 최근 6개월 평균'),
  ('WMA_3M', '3개월 가중 이동평균', 'WEIGHTED_MOVING_AVERAGE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"weights":[3,2,1]}'::jsonb, '최근월부터 3:2:1 가중치'),
  ('PY_SAME_MONTH', '전년 동월', 'SEASONAL_NAIVE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"lag_months":12}'::jsonb, '전년 동월 학습 수요'),
  ('SEASONAL_NAIVE', '계절성 나이브', 'SEASONAL_NAIVE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"lag_months":12}'::jsonb, '12개월 계절 lag')
  on conflict (model_id) do nothing;

alter table core.model_config enable row level security;
alter table core.model_version enable row level security;
alter table core.forecast_result enable row level security;

drop policy if exists step6_model_config_read on core.model_config;
create policy step6_model_config_read on core.model_config for select to authenticated using (auth.uid() is not null);
drop policy if exists step6_model_config_admin_write on core.model_config;
create policy step6_model_config_admin_write on core.model_config for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists step6_model_version_read on core.model_version;
create policy step6_model_version_read on core.model_version for select to authenticated using (auth.uid() is not null);
drop policy if exists step6_forecast_result_read on core.forecast_result;
create policy step6_forecast_result_read on core.forecast_result for select to authenticated using (auth.uid() is not null);

revoke all on core.model_config, core.model_version, core.forecast_result from anon;
revoke insert, update, delete on core.model_config, core.model_version, core.forecast_result from authenticated;
grant select on core.model_config, core.model_version, core.forecast_result to authenticated;

create or replace view analytics.v_model_config as
select model_id, model_name, family, engine, version, enabled, is_default,
       applicable_demand_type, parameters, description, updated_at, updated_by
from core.model_config;

create or replace view analytics.v_forecast_run as
select r.run_id, r.status, r.granularity, r.train_start, r.train_end, r.horizon,
       r.champion_metric, r.models, r.n_models, r.n_items, r.n_rows,
       r.data_snapshot_at, r.started_at, r.finished_at, r.duration_ms,
       r.triggered_by, r.triggered_email, r.note, r.message,
       exists (
         select 1 from core.v_train_demand d
         where d.loaded_at > r.data_snapshot_at
       ) as is_stale,
       case when exists (
         select 1 from core.v_train_demand d
         where d.loaded_at > r.data_snapshot_at
       ) then 'SOURCE_DATA_CHANGED' else null end as stale_reason
from core.forecast_run r;

create or replace view analytics.v_forecast_result as
select f.run_id, f.model_id, f.model_version, v.version, f.item_id, f.period,
       f.predicted_qty, f.p50, f.p80, f.p90, f.sigma, f.basis, f.reason_code
from core.forecast_result f
join core.model_version v on v.model_version_id = f.model_version;

create or replace view analytics.v_forecast_run_kpi as
select r.run_id, r.status, r.n_models, r.n_items, r.n_rows, r.is_stale,
       count(distinct f.model_id)::int as result_models,
       count(distinct f.item_id)::int as result_items,
       count(f.*)::int as result_rows
from analytics.v_forecast_run r
left join core.forecast_result f on f.run_id = r.run_id
group by r.run_id, r.status, r.n_models, r.n_items, r.n_rows, r.is_stale;

grant select on analytics.v_model_config, analytics.v_forecast_run,
  analytics.v_forecast_result, analytics.v_forecast_run_kpi to authenticated;
revoke all on analytics.v_model_config, analytics.v_forecast_run,
  analytics.v_forecast_result, analytics.v_forecast_run_kpi from anon;

create or replace function core.run_baseline_forecast(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = core, analytics, public
as $$
declare
  v_run_id uuid;
  v_snapshot timestamptz := clock_timestamp();
  v_started timestamptz := clock_timestamp();
  v_train_start date;
  v_train_end date;
  v_horizon integer;
  v_granularity text;
  v_models jsonb;
  v_model_count integer;
  v_item_count integer;
  v_row_count integer;
  v_model record;
  v_item record;
  v_period date;
  v_model_version_id uuid;
  v_point numeric;
  v_sigma numeric;
  v_type text;
  v_reason text;
  v_definition text;
begin
  if not core.is_admin() then raise exception '관리자만 Forecast를 실행할 수 있습니다'; end if;

  select train_start, train_end, coalesce(forecast_horizon, 3), granularity
    into v_train_start, v_train_end, v_horizon, v_granularity
  from core.forecast_setting where setting_id = 'default';
  if v_train_start is null or v_train_end is null then raise exception 'Forecast train 기간이 설정되지 않았습니다'; end if;
  if v_horizon <= 0 then raise exception 'Forecast horizon은 1 이상이어야 합니다'; end if;

  select coalesce(jsonb_agg(model_id order by model_id), '[]'::jsonb), count(*)::int
    into v_models, v_model_count
  from core.model_config where enabled = true;
  if v_model_count = 0 then raise exception '활성화된 Forecast 모델이 없습니다'; end if;

  select count(*)::int into v_item_count from (select distinct item_id from analytics.v_sku_demand_profile) x;
  insert into core.forecast_run(run_id, status, granularity, train_start, train_end, horizon, models, n_models, n_items, data_snapshot_at, started_at, triggered_by, triggered_email, note, message)
  values (gen_random_uuid(), 'RUNNING', coalesce(v_granularity, 'MONTH'), v_train_start, v_train_end, v_horizon, v_models, v_model_count, v_item_count, v_snapshot, v_started, auth.uid(), (select email from core.app_user where user_id = auth.uid()), p_note, 'SQL Baseline 실행 중')
  returning run_id into v_run_id;

  create temporary table tmp_train_grid(item_id text, period date, quantity numeric, primary key(item_id, period)) on commit drop;
  insert into tmp_train_grid(item_id, period, quantity)
  select i.item_id, gs.period::date, coalesce(sum(v.qty), 0)::numeric
  from (select distinct item_id from analytics.v_sku_demand_profile) i
  cross join lateral generate_series(date_trunc('month', v_train_start)::date, date_trunc('month', v_train_end)::date, interval '1 month') gs(period)
  left join core.v_train_demand v
    on upper(regexp_replace(v.item_id, '[\s\-_]', '', 'g')) = i.item_id
   and date_trunc('month', v.demand_date)::date = gs.period::date
  group by i.item_id, gs.period;

  for v_model in select * from core.model_config where enabled = true order by model_id loop
    v_definition := coalesce(v_model.description, v_model.model_name) || ' / parameters=' || v_model.parameters::text;
    insert into core.model_version(run_id, model_id, version, parameters, definition)
    values (v_run_id, v_model.model_id, v_model.version, v_model.parameters, v_definition)
    returning model_version_id into v_model_version_id;

    for v_item in select distinct g.item_id, d.demand_type from tmp_train_grid g left join analytics.v_sku_demand_profile d on d.item_id = g.item_id order by g.item_id loop
      v_type := v_item.demand_type;
      for v_period in select (date_trunc('month', v_train_end)::date + (gs.n * interval '1 month'))::date from generate_series(1, v_horizon) as gs(n) loop
        v_point := null;
        v_reason := null;
        if v_type is not null and not (v_type = any(v_model.applicable_demand_type)) then
          v_reason := 'DEMAND_TYPE_NOT_APPLICABLE';
        elsif v_model.model_id = 'MA_3M' then
          select case when count(*) = 3 then avg(quantity) end into v_point from tmp_train_grid where item_id = v_item.item_id and period between date_trunc('month', v_train_end)::date - interval '2 months' and date_trunc('month', v_train_end)::date;
          if v_point is null then v_reason := 'INSUFFICIENT_HISTORY_MA_3M'; end if;
        elsif v_model.model_id = 'MA_6M' then
          select case when count(*) = 6 then avg(quantity) end into v_point from tmp_train_grid where item_id = v_item.item_id and period between date_trunc('month', v_train_end)::date - interval '5 months' and date_trunc('month', v_train_end)::date;
          if v_point is null then v_reason := 'INSUFFICIENT_HISTORY_MA_6M'; end if;
        elsif v_model.model_id = 'WMA_3M' then
          select case when count(*) = 3 then sum(quantity * case when period = date_trunc('month', v_train_end)::date then 3 when period = date_trunc('month', v_train_end)::date - interval '1 month' then 2 else 1 end) / 6 end into v_point from tmp_train_grid where item_id = v_item.item_id and period between date_trunc('month', v_train_end)::date - interval '2 months' and date_trunc('month', v_train_end)::date;
          if v_point is null then v_reason := 'INSUFFICIENT_HISTORY_WMA_3M'; end if;
        elsif v_model.model_id in ('PY_SAME_MONTH', 'SEASONAL_NAIVE') then
          select quantity into v_point from tmp_train_grid where item_id = v_item.item_id and period = v_period - interval '12 months';
          if v_point is null then v_reason := 'INSUFFICIENT_HISTORY_12M'; end if;
        else
          v_reason := 'UNSUPPORTED_MODEL';
        end if;

        if v_model.model_id = 'MA_3M' then
          select stddev_samp(quantity - fitted) into v_sigma from (
            select g.quantity, (select case when count(*) = 3 then avg(h.quantity) end from tmp_train_grid h where h.item_id = g.item_id and h.period between g.period - interval '3 months' and g.period - interval '1 month') as fitted
            from tmp_train_grid g where g.item_id = v_item.item_id
          ) x where fitted is not null;
        elsif v_model.model_id = 'MA_6M' then
          select stddev_samp(quantity - fitted) into v_sigma from (
            select g.quantity, (select case when count(*) = 6 then avg(h.quantity) end from tmp_train_grid h where h.item_id = g.item_id and h.period between g.period - interval '6 months' and g.period - interval '1 month') as fitted
            from tmp_train_grid g where g.item_id = v_item.item_id
          ) x where fitted is not null;
        elsif v_model.model_id = 'WMA_3M' then
          select stddev_samp(quantity - fitted) into v_sigma from (
            select g.quantity, (select case when count(*) = 3 then sum(h.quantity * case when h.period = g.period - interval '1 month' then 3 when h.period = g.period - interval '2 months' then 2 else 1 end) / 6 end from tmp_train_grid h where h.item_id = g.item_id and h.period between g.period - interval '3 months' and g.period - interval '1 month') as fitted
            from tmp_train_grid g where g.item_id = v_item.item_id
          ) x where fitted is not null;
        else
          select stddev_samp(quantity - fitted) into v_sigma from (
            select g.quantity, (select h.quantity from tmp_train_grid h where h.item_id = g.item_id and h.period = g.period - interval '12 months') as fitted
            from tmp_train_grid g where g.item_id = v_item.item_id
          ) x where fitted is not null;
        end if;

        insert into core.forecast_result(run_id, model_id, model_version, item_id, period, predicted_qty, p50, p80, p90, sigma, basis, reason_code)
        values (v_run_id, v_model.model_id, v_model_version_id, v_item.item_id, v_period, v_point, v_point,
          case when v_point is not null and v_sigma is not null then v_point + 0.8416212336 * v_sigma end,
          case when v_point is not null and v_sigma is not null then v_point + 1.2815515655 * v_sigma end,
          v_sigma, v_model.model_id || ' / train_only', v_reason);
      end loop;
    end loop;
  end loop;

  select count(*)::int into v_row_count from core.forecast_result where run_id = v_run_id;
  update core.forecast_run set status = 'SUCCESS', n_rows = v_row_count, finished_at = clock_timestamp(), duration_ms = (extract(epoch from clock_timestamp() - started_at) * 1000)::bigint, message = 'SQL Baseline 실행 완료', updated_at = now() where run_id = v_run_id;
  return v_run_id;
exception when others then
  if v_run_id is not null then
    update core.forecast_run set status = 'FAILED', finished_at = clock_timestamp(), duration_ms = (extract(epoch from clock_timestamp() - started_at) * 1000)::bigint, message = sqlerrm, updated_at = now() where run_id = v_run_id;
  end if;
  raise;
end;
$$;

revoke all on function core.run_baseline_forecast(text) from public;
grant execute on function core.run_baseline_forecast(text) to authenticated;
