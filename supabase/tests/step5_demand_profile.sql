-- STEP 5 migration 적용 후 Supabase SQL Editor에서 실행합니다.
select table_schema, table_name
from information_schema.views
where (table_schema, table_name) in (
  ('analytics', 'v_sku_demand_profile'),
  ('analytics', 'v_demand_profile_kpi')
);

select count(*) filter (where demand_type in ('SMOOTH','INTERMITTENT','ERRATIC','LUMPY')) as classified_count,
       count(*) filter (where demand_type is null and reason_code is null) as invalid_unexplained_count
from analytics.v_sku_demand_profile;

select
  position('core.v_train_demand' in view_definition) > 0 as uses_train_view,
  position('core.v_test_actual' in view_definition) = 0 as excludes_test_view
from pg_views
where schemaname = 'analytics'
  and viewname = 'v_sku_demand_profile';

select * from analytics.v_demand_profile_kpi;


do $$
declare sample record; actual_type text;
begin
  for sample in
    select * from (values
      ('SMOOTH'::text, 1.10::numeric, 0.20::numeric),
      ('INTERMITTENT'::text, 1.32::numeric, 0.20::numeric),
      ('ERRATIC'::text, 1.10::numeric, 0.49::numeric),
      ('LUMPY'::text, 1.32::numeric, 0.49::numeric)
    ) as cases(expected_type, adi_value, cv_squared_value)
  loop
    actual_type := case
      when sample.adi_value < 1.32 and sample.cv_squared_value < 0.49 then 'SMOOTH'
      when sample.adi_value >= 1.32 and sample.cv_squared_value < 0.49 then 'INTERMITTENT'
      when sample.adi_value < 1.32 and sample.cv_squared_value >= 0.49 then 'ERRATIC'
      when sample.adi_value >= 1.32 and sample.cv_squared_value >= 0.49 then 'LUMPY'
    end;
    if actual_type <> sample.expected_type then
      raise exception 'SBC 분류 기준 오류: expected %, got %', sample.expected_type, actual_type;
    end if;
  end loop;
end
$$;

select count(*) as seasonality_without_24_periods
from analytics.v_sku_demand_profile
where n_periods < 24
  and seasonality is not null;

select count(*) as unexplained_unavailable_profiles
from analytics.v_sku_demand_profile
where demand_type is null
  and reason_code is null;
