from __future__ import annotations

import os
from typing import Any

import httpx


async def save_forecast_rows(rows: list[dict[str, Any]]) -> int:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key or not rows:
        return 0
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{url.rstrip('/')}/rest/v1/forecast_result",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "return=minimal"},
            json=rows,
        )
        response.raise_for_status()
    return len(rows)
