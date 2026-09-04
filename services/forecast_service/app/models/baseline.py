from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .base import ForecastModel


def _future_periods(last_period: pd.Timestamp, horizon: int) -> list[str]:
    return [str((last_period + pd.DateOffset(months=index)).date()) for index in range(1, horizon + 1)]


@dataclass
class ExponentialSmoothing(ForecastModel):
    model_id: str = "EXPONENTIAL_SMOOTHING"

    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        alpha = float(params.get("alpha", 0.2))
        rows: list[dict] = []
        for item_id, group in train_df.groupby("item_id"):
            values = group.sort_values("period")["quantity"].astype(float).tolist()
            if len(values) < int(params.get("min_history", 2)):
                point = None
                reason = "INSUFFICIENT_HISTORY"
            else:
                point = values[0]
                for value in values[1:]:
                    point = alpha * value + (1 - alpha) * point
                reason = None
            last = pd.to_datetime(group["period"]).max()
            for period in _future_periods(last, horizon):
                rows.append({"item_id": item_id, "period": period, "predicted_qty": point, "basis": "EXPONENTIAL_SMOOTHING", "reason_code": reason})
        return pd.DataFrame(rows)


@dataclass
class Holt(ForecastModel):
    model_id: str = "HOLT"

    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        damping = float(params.get("damping", 1.0))
        rows: list[dict] = []
        for item_id, group in train_df.groupby("item_id"):
            values = group.sort_values("period")["quantity"].astype(float).tolist()
            last = pd.to_datetime(group["period"]).max()
            if len(values) < int(params.get("min_history", 3)):
                point = None
                reason = "INSUFFICIENT_HISTORY"
            else:
                level, trend = values[0], values[1] - values[0]
                for value in values[1:]:
                    previous = level
                    level = value
                    trend = damping * trend + (1 - damping) * (level - previous)
                point = max(0.0, level + trend)
                reason = None
            for step, period in enumerate(_future_periods(last, horizon), start=1):
                rows.append({"item_id": item_id, "period": period, "predicted_qty": None if point is None else max(0.0, level + trend * step), "basis": "HOLT", "reason_code": reason})
        return pd.DataFrame(rows)


@dataclass
class Croston(ForecastModel):
    model_id: str = "CROSTON"

    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        rows: list[dict] = []
        for item_id, group in train_df.groupby("item_id"):
            ordered = group.sort_values("period")
            nonzero = ordered.loc[ordered["quantity"] > 0, "quantity"].astype(float).tolist()
            last = pd.to_datetime(ordered["period"]).max()
            point = (sum(nonzero) / len(nonzero)) if nonzero else None
            reason = None if point is not None else "NO_NONZERO_DEMAND"
            for period in _future_periods(last, horizon):
                rows.append({"item_id": item_id, "period": period, "predicted_qty": point, "basis": self.model_id, "reason_code": reason})
        return pd.DataFrame(rows)


class SBA(Croston):
    model_id = "SBA"

    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        result = super().forecast(train_df, horizon, params)
        result["predicted_qty"] = result["predicted_qty"].map(lambda value: None if pd.isna(value) else value * 0.95)
        result["basis"] = self.model_id
        return result


class TSB(Croston):
    model_id = "TSB"

class OptionalDependencyModel(ForecastModel):
    dependency_name: str = "optional dependency"

    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        raise RuntimeError(f"{self.model_id} 실행에 필요한 {self.dependency_name}가 설치되지 않았습니다.")


class HoltWinters(OptionalDependencyModel):
    model_id = "HOLT_WINTERS"
    dependency_name = "statsmodels"


class Sarima(OptionalDependencyModel):
    model_id = "SARIMA"
    dependency_name = "statsmodels"


class Prophet(OptionalDependencyModel):
    model_id = "PROPHET"
    dependency_name = "prophet"


class XGBoost(OptionalDependencyModel):
    model_id = "XGBOOST"
    dependency_name = "xgboost"