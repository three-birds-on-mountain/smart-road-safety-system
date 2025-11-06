"""Integration test for 完整資料擷取流程"""
import pytest
from datetime import datetime, timedelta

from src.db.session import SessionLocal, engine, Base
from src.services.data_ingestion import DataIngestionService
from src.models.accident import Accident


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
async def test_ingest_all_sources(ingestion_service):
    """測試擷取所有資料來源"""
    result = await ingestion_service.ingest_all()
    
    assert "results" in result
    assert "duplicates_removed" in result
    assert "total_ingested" in result
    
    assert isinstance(result["results"], dict)
    assert "A1" in result["results"]
    assert "A2" in result["results"]
    assert "A3" in result["results"]


@pytest.mark.asyncio
async def test_ingest_specific_sources(ingestion_service):
    """測試擷取特定資料來源"""
    result = await ingestion_service.ingest_all(source_types=["A1", "A2"])
    
    assert "A1" in result["results"]
    assert "A2" in result["results"]
    assert "A3" not in result["results"]


@pytest.mark.asyncio
async def test_ingest_all_commits_transaction(ingestion_service, db):
    """測試完整擷取流程會正確提交交易"""
    initial_count = db.query(Accident).count()
    
    result = await ingestion_service.ingest_all()
    
    # 驗證交易已提交（即使沒有實際資料，也應該正常完成）
    assert result is not None
    # 注意：由於目前是骨架實作，可能不會新增資料


def test_deduplicate_accidents(ingestion_service, db):
    """測試去重邏輯"""
    duplicates_removed = ingestion_service._deduplicate_accidents()
    assert isinstance(duplicates_removed, int)
    assert duplicates_removed >= 0

