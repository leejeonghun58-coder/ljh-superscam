from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from .config import settings
from .contracts import BacktestRequest, ForecastRequest, ForecastResponse
from .repository import SupabaseRepository
from .service import ForecastService

app = FastAPI(title='SCM Python Forecast Service', version='1.0.0')


def authorize(x_service_key: str | None = Header(default=None)) -> None:
    if not x_service_key or x_service_key != settings.service_api_key:
        raise HTTPException(status_code=401, detail='서비스 인증이 필요합니다.')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'python-forecast-service'}


@app.get('/models', dependencies=[Depends(authorize)])
def models() -> list[dict]:
    return ForecastService().list_models()


@app.post('/forecast/run', response_model=ForecastResponse, dependencies=[Depends(authorize)])
def forecast_run(request: ForecastRequest) -> ForecastResponse:
    try:
        run_id = ForecastService().run(request.model_ids, request.note)
        return ForecastResponse(run_id=run_id, status='SUCCESS')
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post('/backtest/run', response_model=ForecastResponse, dependencies=[Depends(authorize)])
def backtest_run(request: BacktestRequest) -> ForecastResponse:
    try:
        backtest_id = SupabaseRepository().run_backtest(request.forecast_run_id)
        return ForecastResponse(run_id=backtest_id, status='SUCCESS', message='STEP 7 저장 결과를 사용해 Backtest를 실행했습니다.')
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
