"""Integration test for 地圖邊界查詢"""
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
def map_bounds_hotspots(db):
    """建立測試用的熱點資料，分佈在不同區域"""
    today = date.today()
    hotspots = []
    
    # 台北區域（在邊界內）
    taipei_hotspots = [
        (25.0479, 121.5170, "台北車站"),
        (25.0136, 121.4637, "板橋"),
        (25.0330, 121.5654, "內湖"),
    ]
    
    # 台中區域（在邊界外）
    taichung_hotspots = [
        (24.1477, 120.6736, "台中車站"),
    ]
    
    # 高雄區域（在邊界外）
    kaohsiung_hotspots = [
        (22.6273, 120.3014, "高雄車站"),
    ]
    
    all_locations = taipei_hotspots + taichung_hotspots + kaohsiung_hotspots
    
    for i, (lat, lng, name) in enumerate(all_locations):
        hotspot = Hotspot(
            id=uuid4(),
            center_latitude=Decimal(str(lat)),
            center_longitude=Decimal(str(lng)),
            geom=WKTElement(f"POINT({lng} {lat})", srid=4326),
            radius_meters=500,
            total_accidents=10 + i,
            a1_count=i % 2,
            a2_count=5 + i,
            a3_count=4 + i,
            earliest_accident_at=datetime.utcnow() - timedelta(days=30),
            latest_accident_at=datetime.utcnow() - timedelta(days=1),
            analysis_date=today,
            analysis_period_start=today - timedelta(days=365),
            analysis_period_end=today - timedelta(days=1),
            accident_ids=json.dumps([]),
        )
        db.add(hotspot)
        hotspots.append((hotspot, name))
    
    db.commit()
    return hotspots


def test_in_bounds_query_returns_only_inside_hotspots(client, map_bounds_hotspots):
    """測試邊界查詢只回傳範圍內的熱點"""
    # 設定台北區域的邊界
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
    
    # 應該只回傳台北區域的熱點（3個）
    assert len(data["data"]) == 3
    
    # 驗證所有回傳的熱點都在邊界內
    for hotspot in data["data"]:
        assert 24.9 <= hotspot["center_latitude"] <= 25.1
        assert 121.4 <= hotspot["center_longitude"] <= 121.6


def test_in_bounds_query_with_time_range_filter(client, map_bounds_hotspots):
    """測試邊界查詢配合時間範圍篩選"""
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
    
    # 驗證時間篩選生效
    from datetime import timezone
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
    for hotspot in data["data"]:
        latest_date = datetime.fromisoformat(hotspot["latest_accident_at"].replace("Z", "+00:00"))
        assert latest_date >= cutoff_date


def test_in_bounds_query_with_severity_filter(client, map_bounds_hotspots):
    """測試邊界查詢配合嚴重程度篩選"""
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
    
    # 驗證所有回傳的熱點都有 A1 事故
    for hotspot in data["data"]:
        assert hotspot["a1_count"] > 0


def test_in_bounds_query_sorted_by_accident_count(client, map_bounds_hotspots):
    """測試邊界查詢結果按事故數排序"""
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
    
    # 驗證結果按事故數降序排列
    if len(data["data"]) > 1:
        for i in range(len(data["data"]) - 1):
            assert data["data"][i]["total_accidents"] >= data["data"][i + 1]["total_accidents"]


def test_in_bounds_query_respects_limit(client, map_bounds_hotspots):
    """測試邊界查詢遵守 limit 參數"""
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


def test_in_bounds_query_empty_bounds(client, map_bounds_hotspots):
    """測試空邊界查詢"""
    # 設定一個不包含任何熱點的邊界
    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 20.0,
            "sw_lng": 100.0,
            "ne_lat": 21.0,
            "ne_lng": 101.0,
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["data"] == []
    assert data["meta"]["total_count"] == 0


def test_in_bounds_query_large_bounds(client, map_bounds_hotspots):
    """測試大範圍邊界查詢"""
    # 設定包含所有熱點的大邊界
    response = client.get(
        "/api/v1/hotspots/in-bounds",
        params={
            "sw_lat": 20.0,
            "sw_lng": 100.0,
            "ne_lat": 30.0,
            "ne_lng": 130.0,
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    # 應該回傳所有熱點（5個）
    assert len(data["data"]) == 5

