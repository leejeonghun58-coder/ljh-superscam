-- STEP 8: Python Forecast Service 모델 Registry
-- Python 서비스가 활성화된 모델을 읽어 STEP 6 결과 테이블에 저장합니다.

insert into core.model_config(model_id, model_name, family, engine, version, enabled, is_default, applicable_demand_type, parameters, description)
values
  ('EXPONENTIAL_SMOOTHING', '지수평활', 'EXPONENTIAL_SMOOTHING', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{"min_history":2}'::jsonb, 'statsmodels Exponential Smoothing'),
  ('HOLT', 'Holt 추세', 'HOLT', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{"min_history":3}'::jsonb, 'statsmodels Holt linear trend'),
  ('HOLT_WINTERS', 'Holt-Winters', 'HOLT_WINTERS', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{"seasonal_periods":12,"trend":"add","seasonal":"add"}'::jsonb, 'statsmodels Holt-Winters'),
  ('SARIMA', 'SARIMA', 'SARIMA', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{"order":[1,1,1],"seasonal_order":[0,0,0,0],"min_history":12}'::jsonb, 'statsmodels SARIMAX'),
  ('PROPHET', 'Prophet', 'PROPHET', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{"min_history":12,"prophet":{}}'::jsonb, 'optional Prophet engine'),
  ('CROSTON', 'Croston', 'INTERMITTENT', 'PYTHON', '1.0.0', false, false, array['INTERMITTENT','LUMPY'], '{}'::jsonb, '간헐수요 Croston'),
  ('SBA', 'SBA', 'INTERMITTENT', 'PYTHON', '1.0.0', false, false, array['INTERMITTENT','LUMPY'], '{}'::jsonb, 'Syntetos-Boylan adjustment'),
  ('TSB', 'TSB', 'INTERMITTENT', 'PYTHON', '1.0.0', false, false, array['INTERMITTENT','LUMPY'], '{"alpha":0.1,"beta":0.1}'::jsonb, 'Teunter-Syntetos-Babai'),
  ('XGBOOST', 'XGBoost', 'GRADIENT_BOOSTING', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC','INTERMITTENT','LUMPY'], '{"lags":12,"xgboost":{}}'::jsonb, 'optional XGBoost engine')
on conflict (model_id) do update set engine = excluded.engine, family = excluded.family, applicable_demand_type = excluded.applicable_demand_type, parameters = excluded.parameters, description = excluded.description;

comment on column core.model_config.engine is 'SQL 또는 PYTHON. PYTHON 모델은 별도 FastAPI 서비스가 실행하며 동일한 forecast_run/model_version/forecast_result 구조에 저장한다.';
