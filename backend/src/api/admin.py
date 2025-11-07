"""管理端點 API"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import uuid

from src.db.session import get_db
from src.core.auth import decode_hs256_jwt
from src.core.config import get_settings
from src.core.errors import UnauthorizedError
from src.core.logging import get_logger
from src.services.data_ingestion import DataIngestionService
from src.services.hotspot_analysis import HotspotAnalysisService

logger = get_logger(__name__)
settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """驗證管理員 JWT（僅接受 HS256 Bearer Token）"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("此端點需要 Bearer Token")

    payload = decode_hs256_jwt(credentials.credentials, settings.admin_jwt_secret)
    role = payload.get("role")
    scope = payload.get("scope")

    # 允許 role=admin 或 scope 內含 admin 字樣
    if role != "admin":
        scope_values = str(scope).split() if scope else []
        if "admin" not in scope_values:
            raise UnauthorizedError("此端點需要管理員權限")

    return payload


router = APIRouter(dependencies=[Depends(require_admin)])


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
