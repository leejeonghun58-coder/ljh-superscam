from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    note: str | None = None
    model_ids: list[str] | None = None


class BacktestRequest(BaseModel):
    forecast_run_id: str


class ForecastResponse(BaseModel):
    run_id: str
    status: str
    message: str | None = None


class ModelConfig(BaseModel):
    model_id: str
    model_name: str
    family: str
    engine: str
    version: str
    enabled: bool
    applicable_demand_type: list[str] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    description: str | None = None


class ForecastRow(BaseModel):
    item_id: str
    period: date
    predicted_qty: float | None
    sigma: float | None = None
    reason_code: str | None = None
