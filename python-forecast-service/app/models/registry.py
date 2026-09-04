from .base import ForecastModel
from .intermittent import CrostonModel, SBAModel, TSBModel
from .statistical import ExponentialSmoothingModel, HoltModel, HoltWintersModel, SarimaModel


def build_registry() -> dict[str, type[ForecastModel]]:
    registry: dict[str, type[ForecastModel]] = {
        'EXPONENTIAL_SMOOTHING': ExponentialSmoothingModel,
        'HOLT': HoltModel,
        'HOLT_WINTERS': HoltWintersModel,
        'SARIMA': SarimaModel,
        'CROSTON': CrostonModel,
        'SBA': SBAModel,
        'TSB': TSBModel,
    }
    try:
        from .optional import ProphetModel, GradientBoostingModel
        registry.update({'PROPHET': ProphetModel, 'XGBOOST': GradientBoostingModel})
    except ImportError:
        pass
    return registry


