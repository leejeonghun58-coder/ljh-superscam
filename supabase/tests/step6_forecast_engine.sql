-- STEP 6 migration 적용 후 Supabase SQL Editor에서 실행합니다.
select table_schema, table_name
from information_schema.tables
where (table_schema, table_name) in (
  ('core', 'model_config'), ('core', 'model_version'),
  ('core', 'forecast_run'), ('core', 'forecast_result')
)
order by table_schema, table_name;

select table_schema, table_name
from information_schema.views
where (table_schema, table_name) in (
  ('analytics', 'v_model_config'), ('analytics', 'v_forecast_run'),
  ('analytics', 'v_forecast_result'), ('analytics', 'v_forecast_run_kpi')
)
order by table_schema, table_name;

select position('core.v_train_demand' in view_definition) > 0 as uses_train_view,
       position('core.v_test_actual' in view_definition) = 0 as excludes_test_view
from pg_views
where schemaname = 'analytics' and viewname = 'v_forecast_result';

select model_id, version, enabled, parameters, applicable_demand_type
from analytics.v_model_config
order by model_id;

select run_id, status, n_models, n_items, n_rows, is_stale
from analytics.v_forecast_run
order by started_at desc;

select count(*) as missing_model_versions
from analytics.v_forecast_result r
left join core.model_version v on v.model_version_id = r.model_version
where v.model_version_id is null;
