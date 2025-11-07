"""整合測試共用設定：使用假的資料庫與 Hotspot 物件"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from src.db.session import get_db


def make_hotspot(**overrides: Any) -> SimpleNamespace:
    """建立模擬的 Hotspot 物件（提供 API 序列化需要的欄位）"""
    now = datetime.now(timezone.utc)
    defaults: Dict[str, Any] = {
        "id": overrides.get("id", "550e8400-e29b-41d4-a716-446655440000"),
        "center_latitude": Decimal(str(overrides.get("center_latitude", 25.033))),
        "center_longitude": Decimal(str(overrides.get("center_longitude", 121.5654))),
        "radius_meters": overrides.get("radius_meters", 250),
        "total_accidents": overrides.get("total_accidents", 10),
        "a1_count": overrides.get("a1_count", 2),
        "a2_count": overrides.get("a2_count", 5),
        "a3_count": overrides.get("a3_count", 3),
        "earliest_accident_at": overrides.get("earliest_accident_at", now),
        "latest_accident_at": overrides.get("latest_accident_at", now),
        "analysis_date": overrides.get("analysis_date", now.date()),
        "analysis_period_start": overrides.get("analysis_period_start", now.date()),
        "analysis_period_end": overrides.get("analysis_period_end", now.date()),
        "radius": overrides.get("radius", 250),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.fixture
def client():
    """建立測試用 FastAPI Client，並覆寫資料庫依賴以避免真實連線"""
    from src.main import app

    def override_db():
        yield None

    app.dependency_overrides[get_db] = override_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.pop(get_db, None)
