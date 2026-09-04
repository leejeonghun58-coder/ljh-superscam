from __future__ import annotations

import pandas as pd

from .models.base import ForecastModel
from .models.baseline import Croston, ExponentialSmoothing, Holt, HoltWinters, Prophet, SBA, Sarima, TSB, XGBoost


MODEL_REGISTRY: dict[str, type[ForecastModel]] = {
    "EXPONENTIAL_SMOOTHING": ExponentialSmoothing,
    "HOLT": Holt,
    "CROSTON": Croston,
    "SBA": SBA,
    "TSB": TSB,
    "HOLT_WINTERS": HoltWinters,
    "SARIMA": Sarima,
    "PROPHET": Prophet,
    "XGBOOST": XGBoost,
}


def available_models() -> list[str]:
    return sorted(MODEL_REGISTRY)


def run_forecast(model_id: str, rows: list[dict], horizon: int, params: dict) -> pd.DataFrame:
    model_type = MODEL_REGISTRY.get(model_id)
    if model_type is None:
        raise ValueError(f"지원하지 않는 Python 모델입니다: {model_id}")
    frame = pd.DataFrame(rows)
    if frame.empty or not {"item_id", "period", "quantity"}.issubset(frame.columns):
        raise ValueError("train_rows에는 item_id, period, quantity가 필요합니다.")
    if frame["quantity"].isna().any() or (frame["quantity"] < 0).any():
        raise ValueError("학습 수량은 null 또는 음수일 수 없습니다.")
    frame["period"] = pd.to_datetime(frame["period"], errors="raise")
    return model_type().forecast(frame, horizon, params)
