"""參數驗證測試：hotspots API"""
import pytest
from fastapi.testclient import TestClient

from src.db.session import get_db
from src.services.hotspot_service import HotspotService


@pytest.fixture
def client():
    """建立測試客戶端並覆寫資料庫依賴"""
    from src.main import app

    def override_db():
        yield None

    app.dependency_overrides[get_db] = override_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.pop(get_db, None)


def test_nearby_rejects_invalid_distance(client):
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.033,
            "longitude": 121.5654,
            "distance": 200,
        },
    )

    assert response.status_code == 422
    assert "distance 參數僅允許" in response.json()["detail"]


def test_nearby_rejects_invalid_time_range(client):
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.033,
            "longitude": 121.5654,
            "distance": 500,
            "time_range": "2_years",
        },
    )

    assert response.status_code == 422
    assert "time_range 參數" in response.json()["detail"]


def test_nearby_normalizes_severity_levels(monkeypatch, client):
    captured = {}

    def fake_get_nearby(**kwargs):
        captured["severity_levels"] = kwargs.get("severity_levels")
        return []

    monkeypatch.setattr(HotspotService, "get_nearby", staticmethod(fake_get_nearby))

    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.033,
            "longitude": 121.5654,
            "distance": 500,
            "severity_levels": "a1,a2",
        },
    )

    assert response.status_code == 200
    assert captured["severity_levels"] == "A1,A2"


def test_in_bounds_rejects_invalid_severity(client):
    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 24.9,
            "sw_lng": 121.4,
            "ne_lat": 25.1,
            "ne_lng": 121.6,
            "severity_levels": "A4",
        },
    )

    assert response.status_code == 422
    assert "severity_levels 參數格式錯誤" in response.json()["detail"]


def test_in_bounds_normalizes_time_range(monkeypatch, client):
    captured = {}

    def fake_get_in_bounds(**kwargs):
        captured["time_range"] = kwargs.get("time_range")
        return []

    monkeypatch.setattr(HotspotService, "get_in_bounds", staticmethod(fake_get_in_bounds))

    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 24.9,
            "sw_lng": 121.4,
            "ne_lat": 25.1,
            "ne_lng": 121.6,
            "time_range": "6_months",
        },
    )

    assert response.status_code == 200
    assert captured["time_range"] == "6_months"
