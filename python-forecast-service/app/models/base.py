from __future__ import annotations
from abc import ABC, abstractmethod
import pandas as pd


class ForecastModel(ABC):
    model_id: str

    @abstractmethod
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        """period, predicted_qty, sigma, reason_code 컬럼을 반환한다."""
        raise NotImplementedError


def result(periods: pd.DatetimeIndex, values: list[float | None], sigma: float | None, basis: str, reason: str | None = None) -> pd.DataFrame:
    return pd.DataFrame({'period': periods.date, 'predicted_qty': values, 'sigma': sigma, 'basis': basis, 'reason_code': reason})


def numeric_series(train_df: pd.DataFrame) -> pd.Series:
    data = train_df.copy()
    data['period'] = pd.to_datetime(data['period'])
    data['quantity'] = pd.to_numeric(data['quantity'], errors='coerce')
    return data.sort_values('period').set_index('period')['quantity'].dropna()
