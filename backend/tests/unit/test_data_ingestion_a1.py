"""Unit test for A1 資料擷取"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from src.db.session import SessionLocal, engine, Base
from src.services.data_ingestion import DataIngestionService
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
def ingestion_service(db):
    """建立資料擷取服務實例"""
    return DataIngestionService(db)


@pytest.mark.asyncio
async def test_ingest_a1_basic(ingestion_service):
    """測試 A1 資料擷取基本功能"""
    # 由於目前是骨架實作，主要測試不會出錯
    count = await ingestion_service.ingest_a1()
    assert isinstance(count, int)
    assert count >= 0


@pytest.mark.asyncio
async def test_ingest_a1_with_date_range(ingestion_service):
    """測試 A1 資料擷取配合日期範圍"""
    start_date = (datetime.now() - timedelta(days=30)).date().isoformat()
    end_date = datetime.now().date().isoformat()
    
    count = await ingestion_service.ingest_a1(
        start_date=start_date,
        end_date=end_date
    )
    assert isinstance(count, int)
    assert count >= 0


def test_save_accident_a1(ingestion_service, db):
    """測試儲存 A1 事故記錄"""
    accident = ingestion_service._save_accident(
        source_type=SourceType.A1,
        source_id="A1-TEST-001",
        occurred_at=datetime.utcnow(),
        latitude=25.0479,
        longitude=121.5170,
        location_text="台北市測試路段",
        vehicle_type="小客車",
    )
    
    db.commit()
    
    # 驗證事故已儲存
    saved = db.query(Accident).filter(Accident.source_id == "A1-TEST-001").first()
    assert saved is not None
    assert saved.source_type == SourceType.A1


def test_save_accident_duplicate_prevention(ingestion_service, db):
    """測試防止重複儲存事故記錄"""
    # 第一次儲存
    accident1 = ingestion_service._save_accident(
        source_type=SourceType.A1,
        source_id="A1-DUP-001",
        occurred_at=datetime.utcnow(),
        latitude=25.0479,
        longitude=121.5170,
    )
    db.commit()
    
    # 第二次儲存相同 source_id
    accident2 = ingestion_service._save_accident(
        source_type=SourceType.A1,
        source_id="A1-DUP-001",
        occurred_at=datetime.utcnow(),
        latitude=25.0479,
        longitude=121.5170,
    )
    db.commit()
    
    # 應該回傳同一個記錄
    assert accident1.id == accident2.id
    
    # 資料庫中應該只有一筆記錄
    count = db.query(Accident).filter(Accident.source_id == "A1-DUP-001").count()
    assert count == 1

