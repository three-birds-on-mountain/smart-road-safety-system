"""管理端點 API"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import uuid

from src.db.session import get_db
from src.core.errors import UnauthorizedError
from src.core.logging import get_logger
from src.services.data_ingestion import DataIngestionService
from src.services.hotspot_analysis import HotspotAnalysisService

logger = get_logger(__name__)
router = APIRouter()


class DataIngestionRequest(BaseModel):
    """資料擷取請求"""
    source_types: Optional[List[str]] = None
    force_refresh: bool = False


class HotspotAnalysisRequest(BaseModel):
    """熱點分析請求"""
    analysis_period_days: int = 365
    epsilon_meters: int = 500
    min_samples: int = 5


@router.post("/ingest")
async def trigger_data_ingestion(
    request: Optional[DataIngestionRequest] = None,
    db: Session = Depends(get_db),
):
    """
    手動觸發資料擷取

    注意: 此端點應受到認證保護，僅供管理員使用。
    """
    # TODO: 實作認證檢查
    # if not is_admin():
    #     raise UnauthorizedError("此端點需要管理員權限")

    try:
        logger.info("觸發資料擷取")
        service = DataIngestionService(db)
        request_data = request or DataIngestionRequest()

        result = await service.ingest_all(
            source_types=request_data.source_types,
            force_refresh=request_data.force_refresh,
        )

        job_id = str(uuid.uuid4())
        logger.info(f"資料擷取完成: job_id={job_id}, result={result}")

        return {
            "message": "資料擷取工作已排程",
            "job_id": job_id,
            "result": result,
        }
    except Exception as e:
        logger.error(f"資料擷取失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="資料擷取失敗")


@router.post("/analyze-hotspots")
async def trigger_hotspot_analysis(
    request: Optional[HotspotAnalysisRequest] = None,
    db: Session = Depends(get_db),
):
    """
    手動觸發熱點分析

    注意: 此端點應受到認證保護，僅供管理員使用。
    """
    # TODO: 實作認證檢查
    # if not is_admin():
    #     raise UnauthorizedError("此端點需要管理員權限")

    try:
        logger.info("觸發熱點分析")
        service = HotspotAnalysisService(db)
        request_data = request or HotspotAnalysisRequest()

        hotspot_count = service.analyze(
            analysis_period_days=request_data.analysis_period_days,
            epsilon_meters=request_data.epsilon_meters,
            min_samples=request_data.min_samples,
        )

        job_id = str(uuid.uuid4())
        logger.info(f"熱點分析完成: job_id={job_id}, hotspot_count={hotspot_count}")

        return {
            "message": "熱點分析工作已排程",
            "job_id": job_id,
            "hotspot_count": hotspot_count,
        }
    except Exception as e:
        logger.error(f"熱點分析失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="熱點分析失敗")


