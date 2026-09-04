from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


DemandType = Literal["SMOOTH", "INTERMITTENT", "ERRATIC", "LUMPY"]


class TrainRow(BaseModel):
    item_id: str
    period: str
    quantity: float = Field(ge=0)
    demand_type: DemandType | None = None


class ForecastRunRequest(BaseModel):
    run_id: str
    model_id: str
    model_version: str
    horizon: int = Field(gt=0)
    params: dict[str, Any] = Field(default_factory=dict)
    train_rows: list[TrainRow] = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def reject_actual_inputs(cls, value: Any) -> Any:
        if isinstance(value, dict):
            forbidden = {"test_actual", "actual_rows", "raw_usage_history", "test_rows"}
            found = sorted(forbidden.intersection(value))
            if found:
                raise ValueError(f"학습 요청에 검증 Actual을 포함할 수 없습니다: {', '.join(found)}")
        return value


class ForecastRow(BaseModel):
    run_id: str
    model_id: str
    model_version: str
    item_id: str
    period: str
    predicted_qty: float | None
    p50: float | None
    p80: float | None
    p90: float | None
    sigma: float | None = None
    basis: str
    reason_code: str | None = None


class ForecastRunResponse(BaseModel):
    run_id: str
    model_id: str
    rows: list[ForecastRow]
    saved_rows: int = 0


class BacktestRunRequest(BaseModel):
    backtest_run_id: str
    forecast_run_id: str


class ErrorResponse(BaseModel):
    error: str
