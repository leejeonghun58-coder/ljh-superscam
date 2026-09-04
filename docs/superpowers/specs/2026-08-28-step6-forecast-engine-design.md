# STEP 6 Forecast Engine 설계

SQL Baseline 모델을 DB 설정과 실행 이력 중심으로 제공한다. 학습 데이터 경계는 `core.v_train_demand`에 고정하고, 실행 시 모델 정의와 parameters를 `core.model_version`에 불변 snapshot으로 저장한다.

## 구조

- `core.model_config`: 활성 모델과 적용 Demand Type, parameters의 현재 설정
- `core.model_version`: 실행 당시 model_config의 version/parameters/definition snapshot
- `core.forecast_run`: 실행 상태, 학습 기간, horizon, data snapshot, 실행자와 집계
- `core.forecast_result`: run/model/SKU/period별 point와 prediction interval
- `analytics` View: 모델 설정, 실행 이력, 결과, KPI의 읽기 전용 경계

## 계산

월별 Grid는 forecast_setting의 train 기간부터 train_end 다음 월 이후 horizon까지 생성한다. 학습 적합값은 train Grid에서 계산하며, MA/WMA는 필요한 최근 기간이 모두 있을 때만 결과를 낸다. PY_SAME_MONTH와 SEASONAL_NAIVE는 12개월 전 값이 없으면 결과를 만들지 않는다. residual 표준편차가 계산되지 않으면 sigma/P80/P90을 NULL로 둔다.

## 보안과 재현성

실행·모델 변경은 ADMIN RPC/API에서만 수행한다. 과거 결과는 덮어쓰지 않고 run_id로 보존한다. snapshot 이후 source 데이터의 `loaded_at`이 존재하면 analytics run View에서 stale로 표시한다.
