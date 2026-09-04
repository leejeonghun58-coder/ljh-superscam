from __future__ import annotations
import pandas as pd
from .base import ForecastModel, numeric_series, result


class StatsmodelsModel(ForecastModel):
    family = ''
    model_id = ''
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        series = numeric_series(train_df)
        periods = pd.date_range(series.index.max() + pd.offsets.MonthBegin(), periods=horizon, freq='MS') if not series.empty else pd.date_range(pd.Timestamp.today().normalize(), periods=horizon, freq='MS')
        if len(series) < int(params.get('min_history', 2)):
            return result(periods, [None] * horizon, None, self.model_id, 'INSUFFICIENT_HISTORY')
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing, Holt
            if self.model_id == 'EXPONENTIAL_SMOOTHING':
                fitted = ExponentialSmoothing(series, trend=None, seasonal=None, initialization_method='estimated').fit(optimized=True)
            elif self.model_id == 'HOLT':
                fitted = Holt(series, initialization_method='estimated').fit(optimized=True)
            elif self.model_id == 'HOLT_WINTERS':
                season = int(params.get('seasonal_periods', 12))
                if len(series) < season * 2:
                    return result(periods, [None] * horizon, None, self.model_id, 'INSUFFICIENT_SEASONAL_HISTORY')
                fitted = ExponentialSmoothing(series, trend=params.get('trend', 'add'), seasonal=params.get('seasonal', 'add'), seasonal_periods=season, initialization_method='estimated').fit(optimized=True)
            else:
                from statsmodels.tsa.statespace.sarimax import SARIMAX
                order = tuple(params.get('order', [1, 1, 1])); seasonal_order = tuple(params.get('seasonal_order', [0, 0, 0, 0]))
                fitted = SARIMAX(series, order=order, seasonal_order=seasonal_order, enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
            forecast = fitted.forecast(horizon)
            residuals = (series - fitted.fittedvalues.reindex(series.index)).dropna()
            sigma = float(residuals.std(ddof=1)) if len(residuals) >= 2 else None
            return result(periods, [float(value) for value in forecast], sigma, self.model_id)
        except Exception as exc:
            return result(periods, [None] * horizon, None, self.model_id, f'MODEL_ERROR_{type(exc).__name__.upper()}')


class ExponentialSmoothingModel(StatsmodelsModel): model_id = 'EXPONENTIAL_SMOOTHING'
class HoltModel(StatsmodelsModel): model_id = 'HOLT'
class HoltWintersModel(StatsmodelsModel): model_id = 'HOLT_WINTERS'
class SarimaModel(StatsmodelsModel): model_id = 'SARIMA'
