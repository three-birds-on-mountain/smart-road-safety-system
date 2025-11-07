"""整合測試：錯誤處理"""
from src.services.hotspot_service import HotspotService


def test_hotspot_detail_rejects_invalid_uuid(client):
    response = client.get("/api/v1/hotspots/not-a-uuid")
    assert response.status_code == 422
    assert "UUID" in response.json()["detail"]


def test_hotspot_detail_returns_404_when_missing(monkeypatch, client):
    monkeypatch.setattr(HotspotService, "get_by_id", staticmethod(lambda db, hotspot_id: None))

    response = client.get("/api/v1/hotspots/550e8400-e29b-41d4-a716-446655440000")
    assert response.status_code == 404
    assert response.json()["error"] == "not_found"
