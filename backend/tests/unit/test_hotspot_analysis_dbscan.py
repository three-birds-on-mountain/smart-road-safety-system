"""Unit test for DBSCAN 聚類"""
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
def clustered_accidents(db):
    """建立聚類測試用的事故資料（同一區域多個事故）"""
    base_lat, base_lng = 25.0479, 121.5170
    accidents = []
    
    # 建立 10 個接近的事故（形成一個聚類）
    for i in range(10):
        # 在 100 公尺範圍內隨機分佈
        offset_lat = (i % 3 - 1) * 0.0009  # 約 100 公尺
        offset_lng = (i // 3 - 1) * 0.0009
        
        accident = Accident(
            id=uuid4(),
            source_type=SourceType.A2,
            source_id=f"A2-TEST-{i:03d}",
            occurred_at=datetime.utcnow() - timedelta(days=i),
            latitude=Decimal(str(base_lat + offset_lat)),
            longitude=Decimal(str(base_lng + offset_lng)),
            geom=WKTElement(f"POINT({base_lng + offset_lng} {base_lat + offset_lat})", srid=4326),
            severity_level=SeverityLevel.A2 if i % 2 == 0 else SeverityLevel.A3,
            location_text=f"測試路段 {i}",
        )
        db.add(accident)
        accidents.append(accident)
    
    db.commit()
    return accidents


def test_analyze_creates_hotspots(analysis_service, clustered_accidents):
    """測試分析會產生熱點"""
    hotspot_count = analysis_service.analyze(
        analysis_period_days=365,
        epsilon_meters=500,
        min_samples=5,
    )
    
    assert hotspot_count > 0


def test_analyze_with_insufficient_accidents(analysis_service, db):
    """測試事故數量不足時不會產生熱點"""
    # 建立少於 min_samples 的事故
    for i in range(3):
        accident = Accident(
            id=uuid4(),
            source_type=SourceType.A2,
            source_id=f"A2-FEW-{i:03d}",
            occurred_at=datetime.utcnow() - timedelta(days=i),
            latitude=Decimal("25.0479"),
            longitude=Decimal("121.5170"),
            geom=WKTElement("POINT(121.5170 25.0479)", srid=4326),
            severity_level=SeverityLevel.A2,
        )
        db.add(accident)
    db.commit()
    
    hotspot_count = analysis_service.analyze(
        analysis_period_days=365,
        epsilon_meters=500,
        min_samples=5,  # 需要 5 個，但只有 3 個
    )
    
    assert hotspot_count == 0


def test_analyze_respects_period_days(analysis_service, db):
    """測試分析會遵守時間範圍"""
    # 建立舊的事故（超過分析期間）
    old_accident = Accident(
        id=uuid4(),
        source_type=SourceType.A2,
        source_id="A2-OLD-001",
        occurred_at=datetime.utcnow() - timedelta(days=400),  # 超過 365 天
        latitude=Decimal("25.0479"),
        longitude=Decimal("121.5170"),
        geom=WKTElement("POINT(121.5170 25.0479)", srid=4326),
        severity_level=SeverityLevel.A2,
    )
    db.add(old_accident)
    db.commit()
    
    hotspot_count = analysis_service.analyze(
        analysis_period_days=365,  # 只分析過去 365 天
        epsilon_meters=500,
        min_samples=1,
    )
    
    # 舊事故不應該被包含在分析中
    assert hotspot_count == 0

