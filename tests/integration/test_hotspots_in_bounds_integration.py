"""整合測試：GET /hotspots/in-bounds"""
from tests.integration.conftest import make_hotspot
from src.services.hotspot_service import HotspotService


def test_in_bounds_returns_hotspots(monkeypatch, client):
    captured = {}

    def fake_get_in_bounds(**kwargs):
        captured.update(kwargs)
        return [
            make_hotspot(id="1", total_accidents=5, center_latitude=25.0, center_longitude=121.5),
            make_hotspot(id="2", total_accidents=8, center_latitude=25.02, center_longitude=121.52),
        ]

    monkeypatch.setattr(HotspotService, "get_in_bounds", staticmethod(fake_get_in_bounds))

    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 24.9,
            "sw_lng": 121.4,
            "ne_lat": 25.1,
            "ne_lng": 121.6,
            "time_range": "3_months",
            "severity_levels": "A1,A2",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["bounds"]["sw_lat"] == 24.9
    assert len(body["data"]) == 2
    assert body["data"][0]["severity_score"] >= 0

    assert captured["time_range"] == "3_months"
    assert captured["severity_levels"] == "A1,A2"
