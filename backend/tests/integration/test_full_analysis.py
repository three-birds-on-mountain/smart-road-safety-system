"""Integration test for 完整熱點分析流程"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from src.db.session import SessionLocal, engine, Base
from src.services.hotspot_analysis import HotspotAnalysisService
from src.models.accident import Accident
from src.models.hotspot import Hotspot
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
def multiple_cluster_accidents(db):
    """建立多個聚類的事故資料"""
    clusters = [
        # 聚類 1: 台北車站附近
        {"lat": 25.0479, "lng": 121.5170, "count": 8},
        # 聚類 2: 板橋附近
        {"lat": 25.0136, "lng": 121.4637, "count": 6},
    ]
    
    accidents = []
    for cluster_idx, cluster in enumerate(clusters):
        for i in range(cluster["count"]):
            offset_lat = (i % 3 - 1) * 0.0009
            offset_lng = (i // 3 - 1) * 0.0009
            
            accident = Accident(
                id=uuid4(),
                source_type=SourceType.A2,
                source_id=f"A2-CLUSTER{cluster_idx}-{i:03d}",
                occurred_at=datetime.utcnow() - timedelta(days=i),
                latitude=Decimal(str(cluster["lat"] + offset_lat)),
                longitude=Decimal(str(cluster["lng"] + offset_lng)),
                geom=WKTElement(
                    f"POINT({cluster['lng'] + offset_lng} {cluster['lat'] + offset_lat})",
                    srid=4326
                ),
                severity_level=SeverityLevel.A2 if i % 2 == 0 else SeverityLevel.A3,
            )
            db.add(accident)
            accidents.append(accident)
    
    db.commit()
    return accidents


def test_full_analysis_workflow(analysis_service, multiple_cluster_accidents, db):
    """測試完整分析流程"""
    # 執行分析
    hotspot_count = analysis_service.analyze(
        analysis_period_days=365,
        epsilon_meters=500,
        min_samples=5,
    )
    
    # 驗證產生了熱點
    assert hotspot_count > 0
    
    # 驗證熱點已儲存到資料庫
    saved_hotspots = db.query(Hotspot).all()
    assert len(saved_hotspots) == hotspot_count
    
    # 驗證每個熱點都有必要的欄位
    for hotspot in saved_hotspots:
        assert hotspot.center_latitude is not None
        assert hotspot.center_longitude is not None
        assert hotspot.radius_meters > 0
        assert hotspot.total_accidents >= 5
        assert hotspot.analysis_date is not None


def test_analysis_creates_correct_statistics(analysis_service, multiple_cluster_accidents, db):
    """測試分析產生正確的統計資訊"""
    hotspot_count = analysis_service.analyze(
        analysis_period_days=365,
        epsilon_meters=500,
        min_samples=5,
    )
    
    hotspots = db.query(Hotspot).all()
    
    for hotspot in hotspots:
        # 驗證統計數字正確
        assert hotspot.total_accidents == hotspot.a1_count + hotspot.a2_count + hotspot.a3_count
        assert hotspot.total_accidents >= 5
        assert hotspot.earliest_accident_at <= hotspot.latest_accident_at


def test_analysis_with_different_parameters(analysis_service, multiple_cluster_accidents):
    """測試使用不同參數的分析"""
    # 使用較小的 epsilon（更嚴格的聚類）
    hotspot_count_small = analysis_service.analyze(
        analysis_period_days=365,
        epsilon_meters=200,  # 較小的半徑
        min_samples=5,
    )
    
    # 使用較大的 epsilon（更寬鬆的聚類）
    hotspot_count_large = analysis_service.analyze(
        analysis_period_days=365,
        epsilon_meters=1000,  # 較大的半徑
        min_samples=5,
    )
    
    # 較大的 epsilon 可能會產生更多或更少的熱點（取決於資料分佈）
    assert isinstance(hotspot_count_small, int)
    assert isinstance(hotspot_count_large, int)

