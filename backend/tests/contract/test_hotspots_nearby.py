"""Contract test for GET /api/v1/hotspots/nearby"""
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
    
    # 台北車站附近（25.0479, 121.5170）
    hotspot1 = Hotspot(
        id=uuid4(),
        center_latitude=Decimal("25.0479"),
        center_longitude=Decimal("121.5170"),
        geom=WKTElement("POINT(121.5170 25.0479)", srid=4326),
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
        accident_ids=json.dumps(["test-id-1", "test-id-2"]),
    )
    
    # 新北板橋附近（25.0136, 121.4637）
    hotspot2 = Hotspot(
        id=uuid4(),
        center_latitude=Decimal("25.0136"),
        center_longitude=Decimal("121.4637"),
        geom=WKTElement("POINT(121.4637 25.0136)", srid=4326),
        radius_meters=300,
        total_accidents=5,
        a1_count=0,
        a2_count=3,
        a3_count=2,
        earliest_accident_at=datetime.utcnow() - timedelta(days=60),
        latest_accident_at=datetime.utcnow() - timedelta(days=2),
        analysis_date=today,
        analysis_period_start=today - timedelta(days=365),
        analysis_period_end=today - timedelta(days=1),
        accident_ids=json.dumps(["test-id-3"]),
    )
    
    db.add(hotspot1)
    db.add(hotspot2)
    db.commit()
    
    return [hotspot1, hotspot2]


def test_get_nearby_hotspots_success(client, sample_hotspots):
    """測試成功查詢附近熱點"""
    # 台北車站位置
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.0479,
            "longitude": 121.5170,
            "distance": 1000,
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
    assert data["meta"]["user_location"]["latitude"] == 25.0479
    assert data["meta"]["user_location"]["longitude"] == 121.5170
    assert data["meta"]["query_radius_meters"] == 1000
    
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
        assert "earliest_accident_at" in hotspot
        assert "latest_accident_at" in hotspot
        assert "severity_score" in hotspot


def test_get_nearby_hotspots_with_time_range(client, sample_hotspots):
    """測試使用時間範圍篩選"""
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.0479,
            "longitude": 121.5170,
            "distance": 1000,
            "time_range": "1_month",
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "data" in data


def test_get_nearby_hotspots_with_severity_filter(client, sample_hotspots):
    """測試使用嚴重程度篩選"""
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.0479,
            "longitude": 121.5170,
            "distance": 1000,
            "severity_levels": "A1,A2",
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    
    # 驗證回傳的熱點都有 A1 或 A2 事故
    for hotspot in data["data"]:
        assert hotspot["a1_count"] > 0 or hotspot["a2_count"] > 0


def test_get_nearby_hotspots_invalid_latitude(client):
    """測試無效的緯度參數"""
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 30.0,  # 超出範圍
            "longitude": 121.5170,
            "distance": 1000,
        }
    )
    
    assert response.status_code == 422  # Validation error


def test_get_nearby_hotspots_invalid_longitude(client):
    """測試無效的經度參數"""
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.0479,
            "longitude": 130.0,  # 超出範圍
            "distance": 1000,
        }
    )
    
    assert response.status_code == 422  # Validation error


def test_get_nearby_hotspots_invalid_distance(client):
    """測試無效的距離參數"""
    response = client.get(
        "/api/v1/hotspots/nearby",
        params={
            "latitude": 25.0479,
            "longitude": 121.5170,
            "distance": 2000,  # 不在 enum 中
        }
    )
    
    assert response.status_code == 422  # Validation error


def test_get_nearby_hotspots_missing_required_params(client):
    """測試缺少必要參數"""
    response = client.get("/api/v1/hotspots/nearby")
    assert response.status_code == 422  # Validation error

