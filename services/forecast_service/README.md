# Python Forecast Service

STEP 6의 Forecast Result 계약을 유지하는 별도 FastAPI 서비스입니다.

```powershell
cd services/forecast_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:FORECAST_SERVICE_API_KEY = '서버 전용 키'
uvicorn app.main:app --reload --port 8001
```

`POST /forecast/run`은 `train_rows`만 받습니다. `test_actual`, `actual_rows`, `raw_usage_history` 같은 입력은 거부합니다. Supabase 저장이 필요하면 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 서비스 실행 환경에만 설정합니다.
