"""Contract test for GET /api/v1/hotspots/{hotspot_id}"""
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
def sample_hotspot(db):
    """建立測試用的熱點"""
    today = date.today()
    hotspot = Hotspot(
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
        analysis_period_days=365,
        analysis_period_start=today - timedelta(days=365),
        analysis_period_end=today - timedelta(days=1),
        accident_ids=json.dumps(["accident-1", "accident-2"]),
    )
    db.add(hotspot)
    db.commit()
    return hotspot


def test_get_hotspot_by_id_success(client, sample_hotspot):
    """測試成功查詢熱點詳細資訊"""
    hotspot_id = str(sample_hotspot.id)
    response = client.get(f"/api/v1/hotspots/{hotspot_id}")
    
    assert response.status_code == 200
    data = response.json()
    
    # 驗證回應結構
    assert "data" in data
    hotspot_data = data["data"]
    
    # 驗證所有必要欄位
    assert hotspot_data["id"] == hotspot_id
    assert "center_latitude" in hotspot_data
    assert "center_longitude" in hotspot_data
    assert "radius_meters" in hotspot_data
    assert "total_accidents" in hotspot_data
    assert "a1_count" in hotspot_data
    assert "a2_count" in hotspot_data
    assert "a3_count" in hotspot_data
    assert "earliest_accident_at" in hotspot_data
    assert "latest_accident_at" in hotspot_data
    assert "analysis_date" in hotspot_data
    assert "analysis_period_days" in hotspot_data
    assert hotspot_data["analysis_period_days"] == 365
    assert "analysis_period_start" in hotspot_data
    assert "analysis_period_end" in hotspot_data


def test_get_hotspot_by_id_with_accidents(client, sample_hotspot):
    """測試查詢熱點並包含事故記錄"""
    hotspot_id = str(sample_hotspot.id)
    response = client.get(
        f"/api/v1/hotspots/{hotspot_id}",
        params={"include_accidents": True}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "accidents" in data["data"]
    # 注意：目前實作中 accidents 是空陣列，這是預期的


def test_get_hotspot_by_id_with_period_days(client, db):
    """測試 period_days 參數過濾事故日期"""
    from src.models.accident import Accident, SourceType
    from datetime import timezone
    
    # 建立熱點
    today = date.today()
    hotspot_id = uuid4()
    
    # 建立不同時間的事故
    accident_old = Accident(
        id=uuid4(),
        source_type=SourceType.A2,
        source_id="TEST-OLD",
        occurred_at=datetime.now(timezone.utc) - timedelta(days=100),  # 100 天前
        latitude=Decimal("25.0479"),
        longitude=Decimal("121.5170"),
        location_text="測試地點 (舊)",
    )
    
    accident_recent = Accident(
        id=uuid4(),
        source_type=SourceType.A2,
        source_id="TEST-RECENT",
        occurred_at=datetime.now(timezone.utc) - timedelta(days=20),  # 20 天前
        latitude=Decimal("25.0479"),
        longitude=Decimal("121.5170"),
        location_text="測試地點 (新)",
    )
    
    db.add(accident_old)
    db.add(accident_recent)
    db.commit()
    
    # 建立包含這些事故的熱點
    hotspot = Hotspot(
        id=hotspot_id,
        center_latitude=Decimal("25.0479"),
        center_longitude=Decimal("121.5170"),
        geom=WKTElement("POINT(121.5170 25.0479)", srid=4326),
        radius_meters=500,
        total_accidents=2,
        a1_count=0,
        a2_count=2,
        a3_count=0,
        earliest_accident_at=accident_old.occurred_at,
        latest_accident_at=accident_recent.occurred_at,
        analysis_date=today,
        analysis_period_days=365,
        analysis_period_start=today - timedelta(days=365),
        analysis_period_end=today - timedelta(days=1),
        accident_ids=json.dumps([str(accident_old.id), str(accident_recent.id)]),
    )
    db.add(hotspot)
    db.commit()
    
    # 使用 period_days=30 查詢，應該只回傳 20 天前的事故
    response = client.get(
        f"/api/v1/hotspots/{hotspot_id}",
        params={"include_accidents": True, "period_days": 30}
    )
    
    assert response.status_code == 200
    data = response.json()
    accidents = data["data"]["accidents"]
    
    # 應該只有 1 個事故（20 天前的那個）
    assert len(accidents) == 1
    assert accidents[0]["source_id"] == "TEST-RECENT"


def test_get_hotspot_by_id_not_found(client):
    """測試查詢不存在的熱點"""
    fake_id = str(uuid4())
    response = client.get(f"/api/v1/hotspots/{fake_id}")
    
    assert response.status_code == 404
    data = response.json()
    # 檢查錯誤回應格式（我們的錯誤處理器回傳 error 和 message）
    assert "error" in data
    assert "message" in data
    assert data["error"] == "not_found"


def test_get_hotspot_by_id_invalid_uuid(client):
    """測試使用無效的 UUID 格式"""
    response = client.get("/api/v1/hotspots/invalid-uuid")
    
    # UUID 驗證可能會在路由層或服務層處理
    # 預期會回傳 404 或 422
    assert response.status_code in [404, 422]

