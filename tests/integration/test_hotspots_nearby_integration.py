"""整合測試：GET /hotspots/nearby"""
from tests.integration.conftest import make_hotspot
from src.services.hotspot_service import HotspotService


def test_nearby_returns_serialized_payload(monkeypatch, client):
    captured = {}

    def fake_get_nearby(**kwargs):
        captured.update(kwargs)
        return [
            make_hotspot(
                id="1",
                center_latitude=25.0418,
                center_longitude=121.546,
                a1_count=2,
                a2_count=1,
                a3_count=0,
            )
        ]

    monkeypatch.setattr(HotspotService, "get_nearby", staticmethod(fake_get_nearby))

    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.04,
            "longitude": 121.56,
            "distance": 500,
            "time_range": "1_month",
            "severity_levels": "A1",
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert body["meta"]["query_radius_meters"] == 500
    assert body["meta"]["user_location"] == {"latitude": 25.04, "longitude": 121.56}
    assert len(body["data"]) == 1

    hotspot = body["data"][0]
    assert hotspot["id"] == "1"
    assert hotspot["severity_score"] == 13  # 2*5 + 1*3
    assert hotspot["distance_from_user_meters"] >= 0

    assert captured["time_range"] == "1_month"
    assert captured["severity_levels"] == "A1"
