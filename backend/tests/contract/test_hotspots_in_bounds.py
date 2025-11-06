"""Contract test for GET /api/v1/hotspots/in-bounds"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, date
from decimal import Decimal
from uuid import uuid4

from src.db.session import SessionLocal, engine, Base
from src.models.hotspot import Hotspot
from geoalchemy2 import WKTElement
import json


@pytest.fixture(scope="function")
def db():
    """建立測試資料庫連線"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """建立測試客戶端"""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    # 延遲導入 app，避免在模組層級初始化
    from src.main import app
    from src.db.session import get_db
    
    # 設定依賴覆蓋
    app.dependency_overrides[get_db] = override_get_db
    
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        # 清理依賴覆蓋
        app.dependency_overrides.clear()


@pytest.fixture
def sample_hotspots(db):
    """建立測試用的熱點資料"""
    today = date.today()
    hotspots = []
    
    # 台北區域的熱點
    locations = [
        (25.0479, 121.5170, "台北車站"),
        (25.0136, 121.4637, "板橋"),
        (25.0330, 121.5654, "內湖"),
    ]
    
    for lat, lng, name in locations:
        hotspot = Hotspot(
            id=uuid4(),
            center_latitude=Decimal(str(lat)),
            center_longitude=Decimal(str(lng)),
            geom=WKTElement(f"POINT({lng} {lat})", srid=4326),
            radius_meters=500,
            total_accidents=10,
            a1_count=1,
            a2_count=5,
            a3_count=4,
            earliest_accident_at=datetime.utcnow() - timedelta(days=30),
            latest_accident_at=datetime.utcnow() - timedelta(days=1),
            analysis_date=today,
            analysis_period_start=today - timedelta(days=365),
            analysis_period_end=today - timedelta(days=1),
            accident_ids=json.dumps([]),
        )
        db.add(hotspot)
        hotspots.append(hotspot)
    
    db.commit()
    return hotspots


def test_get_hotspots_in_bounds_success(client, sample_hotspots):
    """測試成功查詢範圍內熱點"""
    # 台北區域的邊界
    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 24.9,
            "sw_lng": 121.4,
            "ne_lat": 25.1,
            "ne_lng": 121.6,
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # 驗證回應結構
    assert "data" in data
    assert "meta" in data
    assert isinstance(data["data"], list)
    
    # 驗證 meta 資訊
    assert data["meta"]["total_count"] >= 0
    assert "bounds" in data["meta"]
    assert data["meta"]["bounds"]["sw_lat"] == 24.9
    assert data["meta"]["bounds"]["sw_lng"] == 121.4
    assert data["meta"]["bounds"]["ne_lat"] == 25.1
    assert data["meta"]["bounds"]["ne_lng"] == 121.6
    
    # 驗證熱點資料結構
    if len(data["data"]) > 0:
        hotspot = data["data"][0]
        assert "id" in hotspot
        assert "center_latitude" in hotspot
        assert "center_longitude" in hotspot
        assert "radius_meters" in hotspot
        assert "total_accidents" in hotspot
        assert "a1_count" in hotspot
        assert "a2_count" in hotspot
        assert "a3_count" in hotspot


def test_get_hotspots_in_bounds_with_time_range(client, sample_hotspots):
    """測試使用時間範圍篩選"""
    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 24.9,
            "sw_lng": 121.4,
            "ne_lat": 25.1,
            "ne_lng": 121.6,
            "time_range": "1_month",
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


def test_get_hotspots_in_bounds_with_severity_filter(client, sample_hotspots):
    """測試使用嚴重程度篩選"""
    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 24.9,
            "sw_lng": 121.4,
            "ne_lat": 25.1,
            "ne_lng": 121.6,
            "severity_levels": "A1",
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    
    # 驗證回傳的熱點都有 A1 事故
    for hotspot in data["data"]:
        assert hotspot["a1_count"] > 0


def test_get_hotspots_in_bounds_with_limit(client, sample_hotspots):
    """測試使用 limit 參數"""
    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 24.9,
            "sw_lng": 121.4,
            "ne_lat": 25.1,
            "ne_lng": 121.6,
            "limit": 2,
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) <= 2


def test_get_hotspots_in_bounds_missing_params(client):
    """測試缺少必要參數"""
    response = client.get("/api/v1/hotspots/in-bounds")
    assert response.status_code == 422  # Validation error

