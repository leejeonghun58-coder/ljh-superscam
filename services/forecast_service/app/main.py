from __future__ import annotations

import math
import os

from fastapi import Depends, FastAPI, Header, HTTPException

from .contracts import BacktestRunRequest, ForecastRunRequest, ForecastRunResponse
from .engine import available_models, run_forecast
from .storage import save_forecast_rows

app = FastAPI(title="SCM Python Forecast Service", version="1.0.0")


async def require_service_key(x_service_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("FORECAST_SERVICE_API_KEY")
    if expected and x_service_key != expected:
        raise HTTPException(status_code=401, detail="Python Forecast Service 인증이 필요합니다.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/models", dependencies=[Depends(require_service_key)])
async def models() -> dict[str, list[str]]:
    return {"models": available_models()}


@app.post("/forecast/run", response_model=ForecastRunResponse, dependencies=[Depends(require_service_key)])
async def forecast_run(request: ForecastRunRequest) -> ForecastRunResponse:
    try:
        generated = run_forecast(request.model_id, [row.model_dump() for row in request.train_rows], request.horizon, request.params)
        rows = []
        for record in generated.to_dict(orient="records"):
            point = record["predicted_qty"]
            if point is not None and math.isnan(float(point)):
                point = None
            values = [row.quantity for row in request.train_rows if row.item_id == record["item_id"]]
            sigma = None
            if len(values) >= 2:
                mean = sum(values) / len(values)
                sigma = math.sqrt(sum((value - mean) ** 2 for value in values) / (len(values) - 1))
            p80 = None if point is None or sigma is None else point + 0.841621 * sigma
            p90 = None if point is None or sigma is None else point + 1.281552 * sigma
            rows.append({"run_id": request.run_id, "model_id": request.model_id, "model_version": request.model_version, "item_id": record["item_id"], "period": record["period"], "predicted_qty": point, "p50": point, "p80": p80, "p90": p90, "sigma": sigma, "basis": record["basis"], "reason_code": record.get("reason_code")})
        saved = await save_forecast_rows(rows)
        return ForecastRunResponse(run_id=request.run_id, model_id=request.model_id, rows=rows, saved_rows=saved)
    except Exception as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/backtest/run", dependencies=[Depends(require_service_key)])
async def backtest_run(request: BacktestRunRequest) -> dict[str, str]:
    return {"backtest_run_id": request.backtest_run_id, "status": "DELEGATED_TO_SQL_BACKTEST"}
