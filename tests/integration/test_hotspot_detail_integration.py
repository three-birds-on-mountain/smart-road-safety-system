"""整合測試：GET /hotspots/{id}"""
from tests.integration.conftest import make_hotspot
from src.services.hotspot_service import HotspotService


def test_hotspot_detail_success(monkeypatch, client):
    hotspot = make_hotspot(id="660e8400-e29b-41d4-a716-446655440001")

    def fake_get_by_id(db, hotspot_id):
        assert hotspot_id == hotspot.id
        return hotspot

    monkeypatch.setattr(HotspotService, "get_by_id", staticmethod(fake_get_by_id))

    response = client.get(f"/api/v1/hotspots/{hotspot.id}")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["id"] == hotspot.id
    assert data["analysis_date"]
