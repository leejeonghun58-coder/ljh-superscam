-- STEP 3 학습/검증 격리 검증 쿼리
select count(*) filter (where demand_date between train_start and train_end) as train_in_window,
       count(*) filter (where demand_date >= test_start) as train_test_leak_rows
from core.v_train_demand cross join core.forecast_setting
where setting_id = 'default';

select count(*) filter (where actual_date between test_start and test_end) as test_in_window,
       count(*) filter (where actual_date < test_start or actual_date > test_end) as test_outside_window
from core.v_test_actual cross join core.forecast_setting
where setting_id = 'default';

select * from analytics.v_data_coverage;
select * from analytics.v_forecast_setting;