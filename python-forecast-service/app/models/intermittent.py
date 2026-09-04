from __future__ import annotations
import numpy as np
import pandas as pd
from .base import ForecastModel, numeric_series, result


def _interval(series: pd.Series, horizon: int, params: dict, method: str) -> pd.DataFrame:
    if series.empty:
        return result(pd.date_range(pd.Timestamp.today().normalize(), periods=horizon, freq='MS'), [None] * horizon, None, method, 'NO_HISTORY')
    positive = series[series > 0]
    if positive.empty:
        return result(pd.date_range(series.index.max() + pd.offsets.MonthBegin(), periods=horizon, freq='MS'), [None] * horizon, None, method, 'NO_POSITIVE_DEMAND')
    demand = float(positive.mean())
    intervals = np.diff(positive.index.to_period('M').astype(int))
    interval = float(np.mean(intervals)) if len(intervals) else None
    if interval is None or interval <= 0:
        return result(pd.date_range(series.index.max() + pd.offsets.MonthBegin(), periods=horizon, freq='MS'), [None] * horizon, None, method, 'INSUFFICIENT_INTERARRIVAL_HISTORY')
    point = demand / interval
    sigma = float(positive.std(ddof=1)) if len(positive) >= 2 else None
    periods = pd.date_range(series.index.max() + pd.offsets.MonthBegin(), periods=horizon, freq='MS')
    return result(periods, [point] * horizon, sigma, method)


class CrostonModel(ForecastModel):
    model_id = 'CROSTON'
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        return _interval(numeric_series(train_df), horizon, params, self.model_id)


class SBAModel(ForecastModel):
    model_id = 'SBA'
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        frame = _interval(numeric_series(train_df), horizon, params, self.model_id)
        frame['predicted_qty'] = frame['predicted_qty'].map(lambda value: value * 0.95 if value is not None else None)
        return frame


class TSBModel(ForecastModel):
    model_id = 'TSB'
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        series = numeric_series(train_df)
        if series.empty:
            return _interval(series, horizon, params, self.model_id)
        alpha = float(params.get('alpha', 0.1)); beta = float(params.get('beta', 0.1))
        probability = 0.0; level = 0.0
        for value in series:
            occurrence = 1.0 if value > 0 else 0.0
            probability = probability + alpha * (occurrence - probability)
            if occurrence:
                level = level + beta * (value - level)
        point = probability * level
        sigma = float(series.std(ddof=1)) if len(series) >= 2 else None
        periods = pd.date_range(series.index.max() + pd.offsets.MonthBegin(), periods=horizon, freq='MS')
        return result(periods, [point] * horizon, sigma, self.model_id)
