"""整合測試：事故等級篩選"""
import pytest

from src.services.hotspot_service import HotspotService


@pytest.mark.parametrize(
    ("path", "query", "method_name"),
    [
        (
            "/api/v1/hotspots/nearby",
            {
                "latitude": 25.0,
                "longitude": 121.5,
                "distance": 500,
                "severity_levels": "A1,A3",
            },
            "get_nearby",
        ),
        (
            "/api/v1/hotspots/in-bounds",
            {
                "sw_lat": 24.9,
                "sw_lng": 121.4,
                "ne_lat": 25.1,
                "ne_lng": 121.6,
                "severity_levels": "A2",
            },
            "get_in_bounds",
        ),
    ],
)
def test_severity_levels_passed_to_service(monkeypatch, client, path, query, method_name):
    captured = {}

    def fake_service(**kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr(HotspotService, method_name, staticmethod(fake_service))

    response = client.get(path, params=query)
    assert response.status_code == 200
    assert captured["severity_levels"] == query["severity_levels"]
