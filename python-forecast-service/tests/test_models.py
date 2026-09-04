import pandas as pd
from app.models.intermittent import CrostonModel, SBAModel, TSBModel
from app.models.registry import build_registry


def train(values):
    return pd.DataFrame({'period': pd.date_range('2024-01-01', periods=len(values), freq='MS'), 'quantity': values})


def test_common_registry_contains_required_models():
    registry = build_registry()
    assert {'EXPONENTIAL_SMOOTHING', 'HOLT', 'HOLT_WINTERS', 'SARIMA', 'CROSTON', 'SBA', 'TSB'} <= set(registry)


def test_intermittent_models_return_contract():
    for model in (CrostonModel(), SBAModel(), TSBModel()):
        result = model.forecast(train([0, 0, 10, 0, 0, 12]), 3, {})
        assert list(result.columns) == ['period', 'predicted_qty', 'sigma', 'basis', 'reason_code']
        assert len(result) == 3


def test_no_positive_demand_is_not_imputed():
    result = CrostonModel().forecast(train([0, 0, 0]), 2, {})
    assert result.predicted_qty.isna().all()
    assert set(result.reason_code) == {'NO_POSITIVE_DEMAND'}
