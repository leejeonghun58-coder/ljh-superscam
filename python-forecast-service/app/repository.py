from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
import httpx

from .config import settings
from .contracts import ModelConfig


class SupabaseRepository:
    """Service-role 전용 저장소. 브라우저에는 service role key를 전달하지 않습니다."""

    def __init__(self) -> None:
        self.base = settings.supabase_url.rstrip('/') + '/rest/v1'
        self.headers = {
            'apikey': settings.supabase_service_role_key,
            'Authorization': f'Bearer {settings.supabase_service_role_key}',
            'Content-Type': 'application/json',
        }

    def _get(self, table: str, params: dict[str, str] | None = None, schema: str = 'core') -> list[dict[str, Any]]:
        response = httpx.get(f'{self.base}/{table}', headers={**self.headers, 'Accept-Profile': schema}, params=params or {}, timeout=settings.model_timeout_seconds)
        response.raise_for_status()
        return response.json()

    def _post(self, table: str, payload: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
        response = httpx.post(f'{self.base}/{table}', headers={**self.headers, 'Content-Profile': 'core', 'Prefer': 'return=representation'}, json=payload, timeout=settings.model_timeout_seconds)
        response.raise_for_status()
        return response.json()

    def _patch(self, table: str, params: dict[str, str], payload: dict[str, Any]) -> None:
        response = httpx.patch(f'{self.base}/{table}', headers={**self.headers, 'Content-Profile': 'core'}, params=params, json=payload, timeout=settings.model_timeout_seconds)
        response.raise_for_status()

    def settings(self) -> dict[str, Any]:
        rows = self._get('forecast_setting', {'setting_id': 'eq.default', 'select': '*', 'limit': '1'})
        if not rows:
            raise ValueError('forecast_setting default가 없습니다.')
        return rows[0]

    def models(self, requested: list[str] | None = None) -> list[ModelConfig]:
        params = {'enabled': 'eq.true', 'engine': 'eq.PYTHON', 'select': '*', 'order': 'model_id.asc'}
        if requested:
            params['model_id'] = 'in.(' + ','.join(requested) + ')'
        return [ModelConfig.model_validate(row) for row in self._get('model_config', params)]

    def train_rows(self, start: date, end: date) -> list[dict[str, Any]]:
        return self._get('v_train_demand', {'and': f'(demand_date.gte.{start.isoformat()},demand_date.lte.{end.isoformat()})', 'select': 'item_id,demand_date,qty', 'order': 'item_id,demand_date'}, 'core')

    def profiles(self) -> list[dict[str, Any]]:
        return self._get('v_sku_demand_profile', {'select': 'item_id,demand_type', 'order': 'item_id'}, 'analytics')

    def create_run(self, run_id: str, setting: dict[str, Any], model_ids: list[str], note: str | None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._post('forecast_run', {'run_id': run_id, 'status': 'RUNNING', 'granularity': setting.get('granularity', 'MONTH'), 'train_start': setting['train_start'], 'train_end': setting['train_end'], 'horizon': setting.get('forecast_horizon', setting.get('horizon', 3)), 'models': model_ids, 'n_models': len(model_ids), 'data_snapshot_at': now, 'started_at': now, 'note': note, 'message': 'Python Forecast 실행 중'})

    def snapshot_model(self, run_id: str, model: ModelConfig, definition: str) -> str:
        row = self._post('model_version', {'run_id': run_id, 'model_id': model.model_id, 'version': model.version, 'parameters': model.parameters, 'definition': definition})
        return str(row[0]['model_version_id'])

    def insert_results(self, rows: list[dict[str, Any]]) -> None:
        if rows:
            self._post('forecast_result', rows)

    def finish_run(self, run_id: str, status: str, message: str, n_items: int, n_rows: int) -> None:
        self._patch('forecast_run', {'run_id': f'eq.{run_id}'}, {'status': status, 'n_items': n_items, 'n_rows': n_rows, 'finished_at': datetime.now(timezone.utc).isoformat(), 'message': message})

    def run_backtest(self, forecast_run_id: str) -> str:
        response = httpx.post(f'{self.base}/rpc/run_backtest', headers={**self.headers, 'Content-Profile': 'core'}, json={'p_forecast_run_id': forecast_run_id}, timeout=settings.model_timeout_seconds)
        response.raise_for_status()
        return str(response.json())

