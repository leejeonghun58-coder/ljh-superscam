-- STEP 3: raw 입력 확장, 정책/forecast 설정, train/test 격리
-- 기존 raw 데이터와 계산 view를 drop/recreate하지 않습니다.

create table if not exists raw.business_event (
  event_id text primary key,
  event_type text not null,
  event_date date not null,
  item_id text,
  supplier_id text,
  quantity numeric,
  amount numeric,
  note text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz default now(),
  source_record_id text
);
create table if not exists raw.sales_order (
  order_id text primary key,
  order_date date not null,
  need_date date,
  item_id text not null,
  customer_id text,
  supplier_id text,
  quantity numeric not null,
  unit_price numeric,
  status text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz default now(),
  source_record_id text
);
create table if not exists raw.item_substitute (
  item_id text not null,
  substitute_item_id text not null,
  priority integer,
  valid_from date,
  valid_to date,
  note text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz default now(),
  source_record_id text,
  primary key (item_id, substitute_item_id)
);

-- 기존 입력 테이블은 nullable 추적 컬럼으로 확장해 기존 적재 행을 보존합니다.
do $$ declare table_name text; begin foreach table_name in array array['shipment_log','supplier_master','item_master','inventory','usage_history','forecast','goods_receipt','purchase_order'] loop execute format('alter table raw.%I add column if not exists batch_id uuid', table_name); execute format('alter table raw.%I add column if not exists source_type text', table_name); execute format('alter table raw.%I add column if not exists loaded_at timestamptz default now()', table_name); execute format('alter table raw.%I add column if not exists source_record_id text', table_name); end loop; end $$;

create table if not exists core.policy_config (
  config_key text primary key,
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(numeric_value, text_value, boolean_value) <= 1)
);
create table if not exists core.outlier_rule (
  rule_code text primary key,
  description text not null,
  enabled boolean not null default true,
  action text not null default 'EXCLUDE' check (action in ('EXCLUDE','FLAG')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists core.item_policy (
  item_id text primary key,
  moq numeric,
  pack_size numeric,
  item_grade text,
  service_level numeric,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (moq is null or moq >= 0),
  check (pack_size is null or pack_size > 0),
  check (service_level is null or service_level between 0 and 1)
);
create table if not exists core.forecast_setting (
  setting_id text primary key default 'default',
  train_start date,
  train_end date,
  test_start date,
  test_end date,
  granularity text not null default 'DAY' check (granularity in ('DAY','WEEK','MONTH')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (train_start is null or train_end is null or train_start <= train_end),
  check (test_start is null or test_end is null or test_start <= test_end),
  check (train_end is null or test_start is null or train_end < test_start)
);
insert into core.forecast_setting(setting_id) values ('default') on conflict (setting_id) do nothing;
insert into core.policy_config(config_key, description) values
  ('default_service_level', '공통 서비스 레벨'),
  ('review_period_days', '검토 주기(일)'),
  ('safety_buffer_days', '안전 버퍼(일)')
  on conflict (config_key) do nothing;
insert into core.outlier_rule(rule_code, description, action) values
  ('PROJECT', '프로젝트성 수요', 'EXCLUDE'),
  ('RETURN', '반품 수량', 'EXCLUDE'),
  ('DUPLICATE', '중복 기록', 'EXCLUDE')
  on conflict (rule_code) do nothing;

create or replace function core.touch_step3_updated_at() returns trigger language plpgsql set search_path = core, public as $$ begin new.updated_at = now(); return new; end; $$;
do $$ declare table_name text; begin foreach table_name in array array['policy_config','outlier_rule','item_policy','forecast_setting'] loop execute format('drop trigger if exists %I on core.%I', table_name || '_set_updated_at', table_name); execute format('create trigger %I before update on core.%I for each row execute function core.touch_step3_updated_at()', table_name || '_set_updated_at', table_name); end loop; end $$;

create or replace view core.v_train_demand as
select u.usage_id, u.item_id, u.use_date as demand_date, u.qty, u.warehouse, u.note, u.batch_id, u.source_type, u.loaded_at, u.source_record_id
from raw.usage_history u cross join core.forecast_setting s
where s.setting_id = 'default' and s.train_start is not null and s.train_end is not null and u.use_date between s.train_start and s.train_end;

create or replace view core.v_test_actual as
select u.usage_id, u.item_id, u.use_date as actual_date, u.qty, u.warehouse, u.note, u.batch_id, u.source_type, u.loaded_at, u.source_record_id
from raw.usage_history u cross join core.forecast_setting s
where s.setting_id = 'default' and s.test_start is not null and s.test_end is not null and u.use_date between s.test_start and s.test_end;

-- 기존 Demand Profile/Anomaly도 학습 view만 사용하도록 경계를 고정합니다.
create or replace view core.v_usage_effective as
with calc as (
  select upper(regexp_replace(v.item_id, '[\s\-_]', '', 'g')) as item_id,
         count(*) as valid_days,
         round(avg(v.qty), 2) as daily_usage_avg,
         round(stddev_samp(v.qty), 2) as daily_usage_sd
  from core.v_train_demand v
  where v.qty >= 0 and coalesce(v.note, '') not ilike '%프로젝트%'
  group by upper(regexp_replace(v.item_id, '[\s\-_]', '', 'g'))
)
select c.item_id,
       coalesce(p.valid_days::bigint, c.valid_days) as valid_days,
       coalesce(p.daily_usage_avg, c.daily_usage_avg) as daily_usage_avg,
       coalesce(p.daily_usage_sd, c.daily_usage_sd) as daily_usage_sd,
       round(coalesce(p.daily_usage_avg, c.daily_usage_avg), 2) as usage_used,
       round(coalesce(p.daily_usage_sd, c.daily_usage_sd) / nullif(coalesce(p.daily_usage_avg, c.daily_usage_avg), 0), 2) as cv,
       case when p.item_id is not null then '확정값' else '정제 기준' end as source
from calc c left join core.usage_profile p on p.item_id = c.item_id;

create or replace view analytics.v_usage_anomaly as
with stat as (
  select v.item_id, avg(v.qty) as avg_qty, stddev_samp(v.qty) as sd_qty
  from core.v_train_demand v group by v.item_id
)
select v.usage_id, v.item_id, v.demand_date as use_date, v.qty,
       round(s.avg_qty, 1) as avg_qty,
       round(v.qty / nullif(s.avg_qty, 0), 1) as ratio,
       v.note,
       case when v.qty < 0 then 'RETURN'
            when coalesce(v.note, '') ilike '%프로젝트%' then 'PROJECT'
            else 'UNEXPLAINED' end as anomaly_type
from core.v_train_demand v join stat s on s.item_id = v.item_id
where v.qty > s.avg_qty + (3 * s.sd_qty) or v.qty < 0;
create or replace view analytics.v_data_coverage as
with bounds as (select min(use_date) as data_start, max(use_date) as data_end from raw.usage_history), setting as (select * from core.forecast_setting where setting_id = 'default'), counts as (select (select count(*) from core.v_train_demand) as train_row_count, (select count(*) from core.v_test_actual) as test_row_count)
select bounds.data_start, bounds.data_end, setting.train_start, setting.train_end, setting.test_start, setting.test_end, counts.train_row_count, counts.test_row_count,
  (setting.train_start is not null and setting.train_end is not null and bounds.data_start <= setting.train_start and bounds.data_end >= setting.train_end and setting.train_start <= setting.train_end and counts.train_row_count > 0) as train_window_ok,
  (setting.test_start is not null and setting.test_end is not null and bounds.data_start <= setting.test_start and bounds.data_end >= setting.test_end and setting.test_start <= setting.test_end and counts.test_row_count > 0) as test_window_ok
from bounds cross join setting cross join counts;

create or replace view analytics.v_forecast_setting as
select c.data_start, c.data_end, c.train_start, c.train_end, c.test_start, c.test_end, s.granularity, c.train_row_count, c.test_row_count, c.train_window_ok, c.test_window_ok,
  (c.train_window_ok and c.test_window_ok and not exists (select 1 from core.v_train_demand t join core.v_test_actual v on v.actual_date = t.demand_date)) as isolation_ok,
  coalesce((select jsonb_agg(jsonb_build_object('config_key', p.config_key, 'numeric_value', p.numeric_value, 'text_value', p.text_value, 'boolean_value', p.boolean_value, 'description', p.description) order by p.config_key) from core.policy_config p), '[]'::jsonb) as policy_values
from analytics.v_data_coverage c join core.forecast_setting s on s.setting_id = 'default';

alter table core.policy_config enable row level security;
alter table core.outlier_rule enable row level security;
alter table core.item_policy enable row level security;
alter table core.forecast_setting enable row level security;
drop policy if exists "step3_authenticated_read" on core.policy_config;
create policy "step3_authenticated_read" on core.policy_config for select to authenticated using (auth.uid() is not null);
drop policy if exists "step3_admin_write" on core.policy_config;
create policy "step3_admin_write" on core.policy_config for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists "step3_authenticated_read" on core.outlier_rule;
create policy "step3_authenticated_read" on core.outlier_rule for select to authenticated using (auth.uid() is not null);
drop policy if exists "step3_admin_write" on core.outlier_rule;
create policy "step3_admin_write" on core.outlier_rule for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists "step3_authenticated_read" on core.item_policy;
create policy "step3_authenticated_read" on core.item_policy for select to authenticated using (auth.uid() is not null);
drop policy if exists "step3_admin_write" on core.item_policy;
create policy "step3_admin_write" on core.item_policy for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists "step3_authenticated_read" on core.forecast_setting;
create policy "step3_authenticated_read" on core.forecast_setting for select to authenticated using (auth.uid() is not null);
drop policy if exists "step3_admin_write" on core.forecast_setting;
create policy "step3_admin_write" on core.forecast_setting for all to authenticated using (core.is_admin()) with check (core.is_admin());
revoke all on schema raw from anon, authenticated;
revoke all on all tables in schema raw from anon, authenticated;
revoke all on schema core from anon;
revoke all on schema analytics from anon;
grant usage on schema core, analytics to authenticated;
grant select on core.v_train_demand, core.v_test_actual, core.policy_config, core.outlier_rule, core.item_policy, core.forecast_setting to authenticated;
grant select on analytics.v_data_coverage, analytics.v_forecast_setting to authenticated;
grant insert, update, delete on core.policy_config, core.outlier_rule, core.item_policy, core.forecast_setting to authenticated;