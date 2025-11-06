"""Unit test for 熱點統計計算"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from src.db.session import SessionLocal, engine, Base
from src.services.hotspot_analysis import HotspotAnalysisService
from src.models.accident import Accident
from src.models import SourceType, SeverityLevel
from geoalchemy2 import WKTElement


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


@pytest.fixture
def analysis_service(db):
    """建立熱點分析服務實例"""
    return HotspotAnalysisService(db)


@pytest.fixture
def sample_accidents(db):
    """建立測試用的事故資料"""
    accidents = []
    base_time = datetime.utcnow()
    
    # 建立不同嚴重程度的事故
    for i, severity in enumerate([SeverityLevel.A1, SeverityLevel.A2, SeverityLevel.A3]):
        accident = Accident(
            id=uuid4(),
            source_type=SourceType(severity.value),
            source_id=f"TEST-{severity.value}-{i:03d}",
            occurred_at=base_time - timedelta(days=i),
            latitude=Decimal("25.0479"),
            longitude=Decimal("121.5170"),
            geom=WKTElement("POINT(121.5170 25.0479)", srid=4326),
            severity_level=severity,
        )
        db.add(accident)
        accidents.append(accident)
    
    db.commit()
    return accidents


def test_calculate_hotspot_stats(analysis_service, sample_accidents):
    """測試熱點統計計算"""
    accident_ids = [str(acc.id) for acc in sample_accidents]
    stats = analysis_service.calculate_hotspot_stats(accident_ids)
    
    assert stats["total_accidents"] == 3
    assert stats["a1_count"] == 1
    assert stats["a2_count"] == 1
    assert stats["a3_count"] == 1
    assert "earliest_accident_at" in stats
    assert "latest_accident_at" in stats


def test_calculate_hotspot_center(analysis_service):
    """測試熱點中心點計算"""
    coordinates = [
        (25.0479, 121.5170),
        (25.0480, 121.5171),
        (25.0478, 121.5169),
    ]
    
    center_lat, center_lng = analysis_service.calculate_hotspot_center(coordinates)
    
    # 中心點應該在座標範圍內
    assert 25.0478 <= center_lat <= 25.0480
    assert 121.5169 <= center_lng <= 121.5171


def test_calculate_hotspot_center_empty_list(analysis_service):
    """測試空座標列表會拋出錯誤"""
    with pytest.raises(ValueError):
        analysis_service.calculate_hotspot_center([])


def test_calculate_hotspot_radius(analysis_service):
    """測試熱點半徑計算"""
    center = (25.0479, 121.5170)
    coordinates = [
        (25.0479, 121.5170),  # 中心點
        (25.0480, 121.5171),  # 約 100 公尺外
        (25.0478, 121.5169),  # 約 100 公尺外
    ]
    
    radius = analysis_service.calculate_hotspot_radius(coordinates, center)
    
    # 半徑應該在合理範圍內（50-2000 公尺）
    assert 50 <= radius <= 2000
    assert isinstance(radius, int)


def test_calculate_hotspot_radius_empty_list(analysis_service):
    """測試空座標列表回傳預設半徑"""
    center = (25.0479, 121.5170)
    radius = analysis_service.calculate_hotspot_radius([], center)
    
    assert radius == 100  # 預設半徑

