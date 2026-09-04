from __future__ import annotations
import uuid
import pandas as pd
from .repository import SupabaseRepository
from .models.registry import build_registry


def normalize_item_id(value: object) -> str:
    return ''.join(str(value).upper().split()).replace('-', '').replace('_', '')


class ForecastService:
    def __init__(self, repository: SupabaseRepository | None = None) -> None:
        self.repository = repository or SupabaseRepository()
        self.registry = build_registry()

    def list_models(self) -> list[dict]:
        return [model.model_dump() for model in self.repository.models()]

    def run(self, model_ids: list[str] | None = None, note: str | None = None) -> str:
        setting = self.repository.settings()
        run_id = str(uuid.uuid4())
        models = self.repository.models(model_ids)
        if not models:
            raise ValueError('활성화된 Python 모델이 없습니다.')
        self.repository.create_run(run_id, setting, [model.model_id for model in models], note)
        try:
            train_rows = self.repository.train_rows(pd.Timestamp(setting['train_start']).date(), pd.Timestamp(setting['train_end']).date())
            profiles = {normalize_item_id(row['item_id']): row.get('demand_type') for row in self.repository.profiles()}
            train = pd.DataFrame(train_rows).rename(columns={'demand_date': 'period', 'qty': 'quantity'})
            if train.empty:
                raise ValueError('학습 데이터가 없습니다.')
            train['item_id'] = train['item_id'].map(normalize_item_id)
            horizon = int(setting.get('forecast_horizon', setting.get('horizon', 3)))
            inserted = 0
            item_ids = sorted(train['item_id'].astype(str).unique())
            for model in models:
                if model.model_id not in self.registry:
                    raise ValueError(f'모델 엔진이 설치되지 않았습니다: {model.model_id}')
                version_id = self.repository.snapshot_model(run_id, model, f'Python {model.model_id}; train_only; parameters={model.parameters}')
                model_class = self.registry[model.model_id]
                for item_id in item_ids:
                    demand_type = profiles.get(item_id)
                    if demand_type and model.applicable_demand_type and demand_type not in model.applicable_demand_type:
                        continue
                    frame = model_class().forecast(train[train['item_id'] == item_id][['period', 'quantity']], horizon, model.parameters)
                    rows = []
                    for row in frame.to_dict('records'):
                        point = row['predicted_qty']; sigma = row.get('sigma')
                        rows.append({'run_id': run_id, 'model_id': model.model_id, 'model_version': version_id, 'item_id': item_id, 'period': row['period'].isoformat(), 'predicted_qty': point, 'p50': point, 'p80': point + 0.8416212336 * sigma if point is not None and sigma is not None else None, 'p90': point + 1.2815515655 * sigma if point is not None and sigma is not None else None, 'sigma': sigma, 'basis': row.get('basis', model.model_id + ' / python / train_only'), 'reason_code': row.get('reason_code')})
                    self.repository.insert_results(rows)
                    inserted += len(rows)
            self.repository.finish_run(run_id, 'SUCCESS', 'Python Forecast 실행 완료', len(item_ids), inserted)
            return run_id
        except Exception as exc:
            self.repository.finish_run(run_id, 'FAILED', str(exc), 0, 0)
            raise
