"""Unit test for A3 資料擷取"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock

from src.db.session import SessionLocal, engine, Base
from src.services.data_ingestion import DataIngestionService
from src.services.geocoding import GeocodingService
from src.models.accident import Accident
from src.models import SourceType


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
def mock_geocoding_service():
    """建立模擬的地理編碼服務"""
    service = Mock(spec=GeocodingService)
    service.geocode = AsyncMock(return_value={
        "latitude": 25.0479,
        "longitude": 121.5170,
        "confidence": 0.95,
    })
    return service


@pytest.fixture
def ingestion_service(db, mock_geocoding_service):
    """建立資料擷取服務實例（帶模擬的地理編碼服務）"""
    return DataIngestionService(db, geocoding_service=mock_geocoding_service)


@pytest.mark.asyncio
async def test_ingest_a3_basic(ingestion_service):
    """測試 A3 資料擷取基本功能"""
    count = await ingestion_service.ingest_a3()
    assert isinstance(count, int)
    assert count >= 0


@pytest.mark.asyncio
async def test_ingest_a3_with_date_range(ingestion_service):
    """測試 A3 資料擷取配合日期範圍"""
    start_date = (datetime.now() - timedelta(days=30)).date().isoformat()
    end_date = datetime.now().date().isoformat()
    
    count = await ingestion_service.ingest_a3(
        start_date=start_date,
        end_date=end_date
    )
    assert isinstance(count, int)
    assert count >= 0


def test_save_accident_a3_with_geocoding(ingestion_service, db):
    """測試儲存 A3 事故記錄（需要地理編碼）"""
    accident = ingestion_service._save_accident(
        source_type=SourceType.A3,
        source_id="A3-TEST-001",
        occurred_at=datetime.utcnow(),
        latitude=24.1477,
        longitude=120.6736,
        location_text="台中市測試路段",
        vehicle_type="小客車",
    )
    
    db.commit()
    
    # 驗證事故已儲存
    saved = db.query(Accident).filter(Accident.source_id == "A3-TEST-001").first()
    assert saved is not None
    assert saved.source_type == SourceType.A3

