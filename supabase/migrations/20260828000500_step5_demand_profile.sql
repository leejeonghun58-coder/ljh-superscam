-- STEP 5: 학습 구간 기반 SKU Demand Profile
-- 학습 경계는 core.v_train_demand view에 고정합니다.

create or replace view analytics.v_sku_demand_profile as
with setting as (
  select
    date_trunc('month', train_start)::date as train_start_month,
    date_trunc('month', train_end)::date as train_end_month
  from core.forecast_setting
  where setting_id = 'default'
),
items as (
  select
    upper(regexp_replace(item_id, '[\s\-_]', '', 'g')) as item_id,
    max(item_name) as item_name
  from core.v_item_master
  group by upper(regexp_replace(item_id, '[\s\-_]', '', 'g'))
),
period_grid as (
  select
    i.item_id,
    i.item_name,
    gs.period::date as period,
    row_number() over (partition by i.item_id order by gs.period)::int - 1 as period_index
  from items i
  cross join setting s
  cross join lateral generate_series(s.train_start_month, s.train_end_month, interval '1 month') as gs(period)
  where s.train_start_month is not null
    and s.train_end_month is not null
),
observed as (
  select
    upper(regexp_replace(v.item_id, '[\s\-_]', '', 'g')) as item_id,
    date_trunc('month', v.demand_date)::date as period,
    count(*)::int as source_row_count,
    count(*) filter (where v.qty is null)::int as null_qty_count,
    sum(v.qty) as quantity
  from core.v_train_demand v
  group by upper(regexp_replace(v.item_id, '[\s\-_]', '', 'g')), date_trunc('month', v.demand_date)::date
),
periods as (
  select
    g.item_id,
    g.item_name,
    g.period,
    g.period_index,
    case
      when o.item_id is null then 0::numeric
      when o.null_qty_count > 0 then null::numeric
      else o.quantity
    end as quantity,
    (o.null_qty_count > 0) as source_null
  from period_grid g
  left join observed o on o.item_id = g.item_id and o.period = g.period
),
summary as (
  select
    p.item_id,
    max(p.item_name) as item_name,
    count(*)::int as n_periods,
    count(*) filter (where p.quantity > 0)::int as n_nonzero_periods,
    count(*) filter (where p.quantity = 0)::int as n_zero_periods,
    bool_or(p.source_null) as has_source_null,
    avg(p.quantity) filter (where p.quantity > 0) as positive_mean,
    stddev_samp(p.quantity) filter (where p.quantity > 0) as positive_sd,
    regr_slope(p.quantity, p.period_index) as trend,
    count(*) filter (where p.quantity is not null and p.period >= s.train_end_month - interval '2 months')::int as recent_periods,
    avg(p.quantity) filter (where p.quantity is not null and p.period >= s.train_end_month - interval '2 months') as recent_avg,
    count(*) filter (where p.quantity is not null and p.period between s.train_end_month - interval '5 months' and s.train_end_month - interval '3 months')::int as prior_periods,
    avg(p.quantity) filter (where p.quantity is not null and p.period between s.train_end_month - interval '5 months' and s.train_end_month - interval '3 months') as prior_avg
  from periods p
  cross join setting s
  group by p.item_id
),
month_averages as (
  select
    p.item_id,
    extract(month from p.period)::int as month_number,
    avg(p.quantity) as month_avg
  from periods p
  where p.quantity is not null
  group by p.item_id, extract(month from p.period)::int
),
seasonality_stats as (
  select
    item_id,
    count(*)::int as month_count,
    stddev_samp(month_avg) as month_avg_sd,
    avg(month_avg) as month_avg_mean
  from month_averages
  group by item_id
),
peak as (
  select distinct on (item_id)
    item_id,
    period as peak_period
  from periods
  where quantity > 0
  order by item_id, quantity desc, period asc
),
profile as (
  select
    i.item_id,
    i.item_name,
    coalesce(s.n_periods, 0)::int as n_periods,
    coalesce(s.n_nonzero_periods, 0)::int as n_nonzero_periods,
    case when coalesce(s.n_nonzero_periods, 0) > 0 then round(s.n_periods::numeric / s.n_nonzero_periods, 4) end as adi,
    case when s.n_nonzero_periods >= 2 and s.positive_mean <> 0 then round(s.positive_sd / s.positive_mean, 4) end as cv,
    case when s.n_nonzero_periods >= 2 and s.positive_mean <> 0 then round(power(s.positive_sd / s.positive_mean, 2), 4) end as cv_squared,
    case when coalesce(s.n_periods, 0) > 0 and not coalesce(s.has_source_null, false) then round(s.n_zero_periods::numeric / s.n_periods, 4) end as zero_demand_rate,
    case when s.n_periods >= 2 then round(s.trend::numeric, 4) end as trend,
    case when s.recent_periods = 3 and s.prior_periods = 3 and s.prior_avg <> 0 then round((s.recent_avg / s.prior_avg) - 1, 4) end as recent_change_rate,
    p.peak_period,
    case
      when s.n_nonzero_periods > 0 and s.n_nonzero_periods >= 2 and s.positive_mean <> 0 and s.n_periods::numeric / s.n_nonzero_periods < 1.32 and power(s.positive_sd / s.positive_mean, 2) < 0.49 then 'SMOOTH'
      when s.n_nonzero_periods > 0 and s.n_nonzero_periods >= 2 and s.positive_mean <> 0 and s.n_periods::numeric / s.n_nonzero_periods >= 1.32 and power(s.positive_sd / s.positive_mean, 2) < 0.49 then 'INTERMITTENT'
      when s.n_nonzero_periods > 0 and s.n_nonzero_periods >= 2 and s.positive_mean <> 0 and s.n_periods::numeric / s.n_nonzero_periods < 1.32 and power(s.positive_sd / s.positive_mean, 2) >= 0.49 then 'ERRATIC'
      when s.n_nonzero_periods > 0 and s.n_nonzero_periods >= 2 and s.positive_mean <> 0 and s.n_periods::numeric / s.n_nonzero_periods >= 1.32 and power(s.positive_sd / s.positive_mean, 2) >= 0.49 then 'LUMPY'
    end as demand_type,
    case
      when s.n_periods >= 24 and coalesce(s.has_source_null, false) then null::boolean
      when s.n_periods >= 24 and ss.month_count = 12 and coalesce(ss.month_avg_sd, 0) > 0 then true
      when s.n_periods >= 24 and ss.month_count = 12 then false
    end as seasonality,
    case
      when not exists (select 1 from setting where train_start_month is not null and train_end_month is not null) then 'NO_TRAIN_SETTING'
      when coalesce(s.n_periods, 0) = 0 then 'NO_TRAIN_DATA'
      when s.n_periods < 24 then 'INSUFFICIENT_PERIODS'
      when coalesce(s.has_source_null, false) then 'NULL_QUANTITY'
      when s.n_nonzero_periods = 0 then 'NO_POSITIVE_DEMAND'
      when s.n_nonzero_periods < 2 or s.positive_mean = 0 then 'INSUFFICIENT_NONZERO_PERIODS'
    end as reason_code,
    case
      when s.n_nonzero_periods >= 2 and s.positive_mean <> 0 and s.n_periods::numeric / s.n_nonzero_periods < 1.32 and power(s.positive_sd / s.positive_mean, 2) < 0.49 then 'STABLE'
      when s.n_nonzero_periods >= 2 and s.positive_mean <> 0 then 'VARIABLE'
      else 'UNAVAILABLE'
    end as stability
  from items i
  left join summary s on s.item_id = i.item_id
  left join peak p on p.item_id = i.item_id
  left join seasonality_stats ss on ss.item_id = i.item_id
)
select * from profile;

grant select on analytics.v_sku_demand_profile to authenticated;
revoke all on analytics.v_sku_demand_profile from anon;

create or replace view analytics.v_demand_profile_kpi as
select
  count(*)::int as total_items,
  count(*) filter (where demand_type = 'SMOOTH')::int as n_smooth,
  count(*) filter (where demand_type = 'INTERMITTENT')::int as n_intermittent,
  count(*) filter (where demand_type = 'ERRATIC')::int as n_erratic,
  count(*) filter (where demand_type = 'LUMPY')::int as n_lumpy,
  count(*) filter (where demand_type in ('INTERMITTENT', 'LUMPY'))::int as n_croston_needed,
  count(*) filter (where demand_type is null)::int as n_calculation_unavailable
from analytics.v_sku_demand_profile;

grant select on analytics.v_demand_profile_kpi to authenticated;
revoke all on analytics.v_demand_profile_kpi from anon;


