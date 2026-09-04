from __future__ import annotations
import pandas as pd
from .base import ForecastModel, numeric_series, result


class ProphetModel(ForecastModel):
    model_id = 'PROPHET'
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        from prophet import Prophet
        series = numeric_series(train_df)
        periods = pd.date_range(series.index.max() + pd.offsets.MonthBegin(), periods=horizon, freq='MS')
        if len(series) < int(params.get('min_history', 12)):
            return result(periods, [None] * horizon, None, self.model_id, 'INSUFFICIENT_HISTORY')
        model = Prophet(**params.get('prophet', {})); model.fit(pd.DataFrame({'ds': series.index, 'y': series.values}))
        prediction = model.predict(pd.DataFrame({'ds': periods}))
        sigma = float((series - model.predict(pd.DataFrame({'ds': series.index}))['yhat']).std(ddof=1)) if len(series) >= 2 else None
        return result(periods, prediction['yhat'].astype(float).tolist(), sigma, self.model_id)


class GradientBoostingModel(ForecastModel):
    model_id = 'XGBOOST'
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame:
        import xgboost as xgb
        series = numeric_series(train_df)
        periods = pd.date_range(series.index.max() + pd.offsets.MonthBegin(), periods=horizon, freq='MS')
        lags = int(params.get('lags', 12))
        if len(series) <= lags:
            return result(periods, [None] * horizon, None, self.model_id, 'INSUFFICIENT_HISTORY_LAGS')
        frame = pd.DataFrame({'y': series.values})
        for lag in range(1, lags + 1): frame[f'lag_{lag}'] = frame.y.shift(lag)
        frame = frame.dropna(); model = xgb.XGBRegressor(**params.get('xgboost', {})); model.fit(frame.drop(columns='y'), frame.y)
        history = series.tolist(); values: list[float] = []
        for _ in range(horizon):
            features = pd.DataFrame([[*history[-lags:][::-1]]], columns=[f'lag_{lag}' for lag in range(1, lags + 1)])
            value = float(model.predict(features)[0]); values.append(value); history.append(value)
        residuals = frame.y - model.predict(frame.drop(columns='y')); sigma = float(pd.Series(residuals).std(ddof=1)) if len(residuals) >= 2 else None
        return result(periods, values, sigma, self.model_id)
