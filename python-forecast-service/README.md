# Python Forecast Service

FastAPI 기반의 독립 배치 Forecast 서비스입니다. `.env`에 다음 서버 전용 값을 설정합니다.

```env
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SERVICE_API_KEY=change-me
```

`SUPABASE_SERVICE_ROLE_KEY`와 `SERVICE_API_KEY`는 Next.js 브라우저 코드에 넣지 않습니다.

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`core.model_config.enabled=true`인 `engine=PYTHON` 모델만 실행됩니다. 학습 데이터는 `core.v_train_demand`에서만 읽고, 검증 Actual은 읽지 않습니다. 실행 결과는 STEP 6의 `core.forecast_run`, `core.model_version`, `core.forecast_result`에 기록되므로 기존 STEP 7 Model Comparison에서 SQL 모델과 함께 조회됩니다.
