-- STEP 9: 정책화된 Lead Time + Forecast 기반 Inventory Projection
-- Projection은 core.v_train_demand/raw usage를 재계산하지 않고, STEP 7 Forecast Result를 사용합니다.

alter table core.leadtime_plan
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists core.leadtime_plan_history (
  history_id bigint generated always as identity primary key,
  supplier_id text not null,
  old_planned_lead_time numeric,
  new_planned_lead_time numeric,
  old_basis text,
  new_basis text,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists leadtime_plan_history_lookup_idx
  on core.leadtime_plan_history(supplier_id, changed_at desc);

create or replace function core.log_leadtime_plan_change()
returns trigger language plpgsql security definer set search_path = core, public as $$
begin
  insert into core.leadtime_plan_history
    (supplier_id, old_planned_lead_time, new_planned_lead_time, old_basis, new_basis, reason, changed_by)
  values
    (coalesce(new.supplier_id, old.supplier_id), old.planned_lead_time, new.planned_lead_time,
     old.basis, new.basis, new.confirmed_reason, coalesce(new.updated_by, auth.uid()));
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists step9_leadtime_plan_history on core.leadtime_plan;
create trigger step9_leadtime_plan_history
before insert or update on core.leadtime_plan
for each row execute function core.log_leadtime_plan_change();

create or replace function core.set_leadtime_policy(
  p_supplier_id text,
  p_planned_lead_time numeric,
  p_basis text default 'ADMIN_CONFIRMED',
  p_service_level numeric default null,
  p_confirmed_reason text default null
) returns core.leadtime_plan
language plpgsql security definer set search_path = core, public as $$
declare v_row core.leadtime_plan;
begin
  if not core.is_admin() then raise exception '관리자만 Lead Time 정책을 변경할 수 있습니다'; end if;
  if nullif(trim(p_supplier_id), '') is null then raise exception '공급처는 필수입니다'; end if;
  if p_planned_lead_time is not null and p_planned_lead_time < 0 then raise exception 'Lead Time은 음수일 수 없습니다'; end if;
  insert into core.leadtime_plan(supplier_id, planned_lead_time, basis, service_level, confirmed_reason, confirmed_at, updated_by)
  values (trim(p_supplier_id), p_planned_lead_time, coalesce(nullif(trim(p_basis), ''), 'ADMIN_CONFIRMED'), p_service_level, p_confirmed_reason, case when p_planned_lead_time is null then null else now() end, auth.uid())
  on conflict (supplier_id) do update set
    planned_lead_time = excluded.planned_lead_time,
    basis = excluded.basis,
    service_level = excluded.service_level,
    confirmed_reason = excluded.confirmed_reason,
    confirmed_at = excluded.confirmed_at,
    updated_by = auth.uid();
  select * into v_row from core.leadtime_plan where supplier_id = trim(p_supplier_id);
  return v_row;
end;
$$;

revoke all on function core.set_leadtime_policy(text,numeric,text,numeric,text) from public;
grant execute on function core.set_leadtime_policy(text,numeric,text,numeric,text) to authenticated;

insert into core.policy_config(config_key, numeric_value, description)
values ('leadtime_min_samples', 3, 'P80 Lead Time을 fallback으로 사용할 최소 실적 표본 수')
on conflict (config_key) do nothing;

create or replace view core.v_leadtime_effective as
with threshold as (
  select coalesce((select numeric_value from core.policy_config where config_key = 'leadtime_min_samples'), 3) min_samples
), stat as (
  select * from core.v_leadtime_stat
), policy as (
  select * from core.leadtime_plan
)
select s.supplier_id, s.supplier_name, s.country, s.n_samples,
       s.mean_days, s.p50_days, s.p80_days, s.p90_days,
       p.planned_lead_time, p.basis, p.confirmed_reason, p.confirmed_at,
       case when p.planned_lead_time is not null then p.planned_lead_time
            when s.p80_days is not null and s.n_samples >= t.min_samples then s.p80_days
            else null end as effective_lead_time,
       case when p.planned_lead_time is not null then 'ADMIN_CONFIRMED'
            when s.p80_days is not null and s.n_samples >= t.min_samples then 'ACTUAL_P80'
            else null end as effective_lead_time_source,
       case when p.planned_lead_time is not null then null
            when coalesce(s.n_samples, 0) = 0 then 'NO_LEADTIME'
            when s.p80_days is null or s.n_samples < t.min_samples then 'INSUFFICIENT_SAMPLE'
            else null end as reason_code
from stat s left join policy p using (supplier_id) cross join threshold t;

create or replace view analytics.v_leadtime_policy as
select i.item_id, i.item_name, i.supplier_id, e.supplier_name, e.country,
       e.n_samples, e.mean_days, e.p50_days, e.p80_days, e.p90_days,
       e.planned_lead_time as admin_confirmed_lead_time,
       e.effective_lead_time, e.effective_lead_time_source,
       e.confirmed_at as applied_at, e.confirmed_reason, e.reason_code,
       h.changed_at as last_changed_at, h.changed_by as last_changed_by,
       (select count(*) from core.leadtime_plan_history hx where hx.supplier_id = i.supplier_id) as change_count
from core.v_item_master i left join core.v_leadtime_effective e using (supplier_id)
left join lateral (select changed_at, changed_by from core.leadtime_plan_history hx where hx.supplier_id=i.supplier_id order by changed_at desc limit 1) h on true
where coalesce(i.is_active, 'Y') in ('Y','y','TRUE','true','1');

create or replace view analytics.v_leadtime_policy_history as
select h.*, s.supplier_name, s.country
from core.leadtime_plan_history h
left join core.v_leadtime_stat s using (supplier_id);

-- Open PO: 납기예정일 월에만 미입고 잔량을 반영합니다. 상태 컬럼이 없는 기존 raw 스키마에서는
-- 발주량-입고량을 잔량으로 해석하며, 입고가 전혀 없으면 아직 open인 것으로 봅니다.
create or replace view core.v_open_po_schedule as
with po as (
  select trim("발주번호") po_no,
         upper(regexp_replace(trim("품목코드"), '[\s\-_]', '', 'g')) item_id,
         case when trim("납기예정일") ~ '^\d{4}[-/]\d{2}[-/]\d{2}$' then replace(trim("납기예정일"), '/', '-')::date end scheduled_receipt_date,
         case when trim("발주수량") ~ '^-?\d+(\.\d+)?$' then trim("발주수량")::numeric end ordered_qty
  from raw.purchase_order
), receipt as (
  select trim("발주번호") po_no, upper(regexp_replace(trim("품목코드"), '[\s\-_]', '', 'g')) item_id,
         sum(case when trim("입고수량") ~ '^-?\d+(\.\d+)?$' then trim("입고수량")::numeric else 0 end) received_qty
  from raw.goods_receipt group by 1,2
)
select p.item_id, date_trunc('month', p.scheduled_receipt_date)::date period,
       sum(greatest(p.ordered_qty - coalesce(r.received_qty, 0), 0)) scheduled_receipt
from po p left join receipt r using (po_no, item_id)
where p.item_id is not null and p.scheduled_receipt_date is not null and p.ordered_qty is not null
  and p.ordered_qty > coalesce(r.received_qty, 0)
group by p.item_id, date_trunc('month', p.scheduled_receipt_date)::date;

create or replace view core.v_confirmed_sales_order_schedule as
select upper(regexp_replace(trim(item_id), '[\s\-_]', '', 'g')) item_id,
       date_trunc('month', need_date)::date period,
       sum(quantity) confirmed_sales_order
from raw.sales_order
where need_date is not null and quantity is not null
  and upper(trim(coalesce(status, ''))) in ('CONFIRMED','CONFIRM','Y','TRUE','확정')
group by 1,2;

-- Soft Allocation 전용 테이블이 없는 현재 스키마에서는 raw.business_event의 표준 event_type을 사용합니다.
-- 매칭 행이 없을 때 amount=0과 함께 NO_RECORD를 노출해 "구조적 0"과 구분합니다.
create or replace view core.v_soft_allocation_schedule as
select upper(regexp_replace(trim(item_id), '[\s\-_]', '', 'g')) item_id,
       date_trunc('month', event_date)::date period,
       sum(quantity) soft_allocation,
       'PRESENT'::text data_status
from raw.business_event
where event_date is not null and quantity is not null
  and upper(trim(event_type)) in ('SOFT_ALLOCATION','SOFT_ALLOC','RESERVATION','가예약')
group by 1,2;

drop view if exists analytics.v_stockout_kpi;
drop view if exists analytics.v_stockout_risk;
drop view if exists analytics.v_inventory_projection;

create or replace view analytics.v_inventory_projection as
with setting as (
  select train_end, greatest(coalesce(forecast_horizon, 0), 0)::int horizon
  from core.forecast_setting where setting_id = 'default'
), periods as (
  select (s.train_end + (gs.n * interval '1 month'))::date period
  from setting s cross join lateral generate_series(1, s.horizon) as gs(n)
  where s.train_end is not null and s.horizon > 0
), items as (
  select item_id, item_name, supplier_id
  from core.v_item_master where coalesce(is_active, 'Y') in ('Y','y','TRUE','true','1')
), stock as (
  select item_id, current_stock available_inventory from core.v_stock_on_hand
), champions as (
  select distinct on (c.item_id) c.item_id, c.champion_model_id model_id, c.model_version,
         c.backtest_run_id, b.forecast_run_id, 'CHAMPION'::text forecast_source
  from core.champion_model c join core.backtest_run b using (backtest_run_id)
  where b.status = 'SUCCESS'
  order by c.item_id, c.selected_at desc
), defaults as (
  select distinct on (f.item_id) upper(regexp_replace(f.item_id, '[\s\-_]', '', 'g')) item_id,
         f.model_id, f.model_version, f.run_id forecast_run_id, 'DEFAULT'::text forecast_source
  from core.forecast_result f join core.forecast_run r using (run_id)
  join core.model_config m using (model_id)
  where r.status = 'SUCCESS' and m.is_default = true
  order by f.item_id, r.started_at desc
), selected_forecast as (
  select i.item_id, i.period, coalesce(c.model_id, d.model_id) model_id,
         coalesce(c.model_version, d.model_version) model_version,
         coalesce(c.forecast_run_id, d.forecast_run_id) forecast_run_id,
         coalesce(c.forecast_source, d.forecast_source) forecast_source,
         f.p50 gross_forecast_demand
  from (select i.item_id, p.period from items i cross join periods p) i
  left join champions c using (item_id)
  left join defaults d using (item_id)
  left join core.forecast_result f on f.item_id=i.item_id and f.period=i.period
    and f.model_id=coalesce(c.model_id,d.model_id)
    and f.model_version=coalesce(c.model_version,d.model_version)
    and f.run_id=coalesce(c.forecast_run_id,d.forecast_run_id)
), inputs as (
  select i.item_id, i.item_name, i.supplier_id, p.period,
         s.available_inventory, f.model_id, f.model_version, f.forecast_run_id, f.forecast_source,
         po.scheduled_receipt,
         coalesce(so.confirmed_sales_order, 0)::numeric confirmed_sales_order,
         coalesce(sa.soft_allocation, 0)::numeric soft_allocation,
         coalesce(sa.data_status, 'NO_RECORD') soft_allocation_data_status,
         f.gross_forecast_demand,
         case when f.gross_forecast_demand is null then null
              else greatest(f.gross_forecast_demand - coalesce(so.confirmed_sales_order, 0), 0) end forecast_demand,
         e.effective_lead_time, e.effective_lead_time_source, e.reason_code leadtime_reason_code
  from items i cross join periods p
  left join stock s using (item_id)
  left join selected_forecast f using (item_id, period)
  left join core.v_open_po_schedule po using (item_id, period)
  left join core.v_confirmed_sales_order_schedule so using (item_id, period)
  left join core.v_soft_allocation_schedule sa using (item_id, period)
  left join core.v_leadtime_effective e using (supplier_id)
), calculated as (
  select x.*,
         case when x.available_inventory is null or x.forecast_demand is null then null
              else x.available_inventory + coalesce(sum(coalesce(x.scheduled_receipt,0) - x.soft_allocation - x.confirmed_sales_order - x.forecast_demand)
                   over (partition by x.item_id order by x.period rows between unbounded preceding and 1 preceding), 0) end beginning_inventory,
         case when x.available_inventory is null or x.forecast_demand is null then null
              else x.available_inventory + sum(coalesce(x.scheduled_receipt,0) - x.soft_allocation - x.confirmed_sales_order - x.forecast_demand)
                   over (partition by x.item_id order by x.period rows between unbounded preceding and current row) end ending_projected_inventory
  from inputs x
)
select c.item_id, c.item_name, c.supplier_id, c.period, c.beginning_inventory,
       coalesce(c.scheduled_receipt, 0)::numeric scheduled_receipt,
       c.confirmed_sales_order, c.soft_allocation, c.soft_allocation_data_status,
       c.available_inventory, c.gross_forecast_demand, c.forecast_demand, c.ending_projected_inventory,
       c.effective_lead_time, c.effective_lead_time_source, c.model_id, c.model_version,
       c.forecast_run_id, c.forecast_source,
       case when c.available_inventory is null then 'NO_INVENTORY_DATA'
            when c.forecast_demand is null then 'NO_FORECAST'
            when c.effective_lead_time is null then coalesce(c.leadtime_reason_code, 'NO_LEADTIME')
            else null end reason_code,
       case when c.available_inventory is null or c.forecast_demand is null or c.effective_lead_time is null then 'CALCULATION_UNAVAILABLE'
            else 'CALCULATED' end projection_status
from calculated c;

create or replace view analytics.v_stockout_risk as
with horizon as (
  select p.item_id, min(p.period) first_period, max(p.period) last_period,
         max(p.available_inventory) current_stock,
         max(p.effective_lead_time) effective_lead_time,
         max(p.effective_lead_time_source) effective_lead_time_source,
         max(p.model_id) champion_model_id, max(p.model_version) model_version,
         max(p.forecast_run_id) forecast_run_id,
         count(*) projected_periods,
         count(*) filter (where p.projection_status='CALCULATED') calculated_periods
  from analytics.v_inventory_projection p group by p.item_id
), first_out as (
  select distinct on (item_id) item_id, period stockout_period
  from analytics.v_inventory_projection
  where projection_status='CALCULATED' and ending_projected_inventory <= 0
  order by item_id, period
), reasons as (
  select item_id, min(reason_code) filter (where reason_code is not null) reason_code
  from analytics.v_inventory_projection group by item_id
)
select h.item_id, max(p.item_name) item_name, max(p.supplier_id) supplier_id,
       h.current_stock, h.effective_lead_time, h.effective_lead_time_source,
       o.stockout_period, o.stockout_period stockout_date,
       case when o.stockout_period is null then (h.last_period - current_date)::int
            else (o.stockout_period - current_date)::int end days_of_supply,
       case when o.stockout_period is null then ((extract(year from age(h.last_period, current_date))*12 + extract(month from age(h.last_period, current_date)))::numeric)
            else ((extract(year from age(o.stockout_period, current_date))*12 + extract(month from age(o.stockout_period, current_date)))::numeric) end months_of_supply,
       case when h.current_stock is null then 'CALCULATION_UNAVAILABLE'
            when h.calculated_periods < h.projected_periods then 'CALCULATION_UNAVAILABLE'
            when h.effective_lead_time is null then 'CALCULATION_UNAVAILABLE'
            when o.stockout_period is null then 'SAFE'
            when o.stockout_period <= date_trunc('month', current_date + (h.effective_lead_time * interval '1 day'))::date then 'CRITICAL'
            else 'WARNING' end risk_status,
       case when h.current_stock is null then 'NO_INVENTORY_DATA'
            when h.calculated_periods < h.projected_periods then coalesce(r.reason_code, 'NO_FORECAST')
            when h.effective_lead_time is null then 'NO_LEADTIME'
            else null end reason_code,
       h.champion_model_id, h.model_version, h.forecast_run_id, h.projected_periods
from horizon h join analytics.v_inventory_projection p using (item_id)
left join first_out o using (item_id) left join reasons r using (item_id)
group by h.item_id,h.current_stock,h.effective_lead_time,h.effective_lead_time_source,h.last_period,h.projected_periods,h.calculated_periods,h.champion_model_id,h.model_version,h.forecast_run_id,o.stockout_period,r.reason_code;

create or replace view analytics.v_stockout_kpi as
select count(*)::int n_items,
       count(*) filter (where risk_status='CRITICAL')::int n_critical,
       count(*) filter (where risk_status='WARNING')::int n_warning,
       count(*) filter (where risk_status='SAFE')::int n_safe,
       count(*) filter (where risk_status='CALCULATION_UNAVAILABLE')::int n_unavailable,
       count(*) filter (where stockout_period <= current_date + 30)::int n_within_30d,
       avg(days_of_supply) filter (where days_of_supply is not null) avg_stockout_days
from analytics.v_stockout_risk;

alter table core.leadtime_plan enable row level security;
alter table core.leadtime_plan_history enable row level security;
drop policy if exists step9_leadtime_read on core.leadtime_plan;
create policy step9_leadtime_read on core.leadtime_plan for select to authenticated using (auth.uid() is not null);
drop policy if exists step9_leadtime_admin on core.leadtime_plan;
create policy step9_leadtime_admin on core.leadtime_plan for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists step9_leadtime_history_read on core.leadtime_plan_history;
create policy step9_leadtime_history_read on core.leadtime_plan_history for select to authenticated using (auth.uid() is not null);

revoke all on core.leadtime_plan, core.leadtime_plan_history from anon;
grant select on core.leadtime_plan, core.leadtime_plan_history to authenticated;
grant usage on schema analytics to authenticated;
grant select on analytics.v_leadtime_policy, analytics.v_leadtime_policy_history, analytics.v_inventory_projection, analytics.v_stockout_risk, analytics.v_stockout_kpi to authenticated;
revoke all on analytics.v_leadtime_policy, analytics.v_leadtime_policy_history, analytics.v_inventory_projection, analytics.v_stockout_risk, analytics.v_stockout_kpi from anon;

comment on view analytics.v_inventory_projection is '월별 Projection: beginning + scheduled receipt - soft allocation - confirmed sales order - net forecast demand. 확정수주는 gross forecast에서 차감하여 중복 차감을 방지한다. Forecast/Inventory/Effective Lead Time이 없으면 NULL과 reason_code를 유지한다.';
comment on view analytics.v_stockout_risk is '월별 Projection에서 최초 ending_projected_inventory <= 0인 월을 stockout_period로 사용한다. monthly granularity이므로 stockout_date는 해당 월의 1일이다. Lead Time 도착월 전/당월 결품은 CRITICAL, 이후 결품은 WARNING, projection horizon 내 결품 없음은 SAFE다.';
