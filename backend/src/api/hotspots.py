"""熱點查詢API"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid
import re

from src.db.session import get_db
from src.core.errors import NotFoundError
from src.core.logging import get_logger
from src.services.hotspot_service import HotspotService, calculate_severity_score
from src.models.accident import Accident

logger = get_logger(__name__)
router = APIRouter()

ALLOWED_PERIOD_DAYS = (30, 90, 180, 365)
SEVERITY_PATTERN = re.compile(r"^(A1|A2|A3)(,(A1|A2|A3))*$")


def _validate_period_days(days: Optional[int]) -> int:
    """驗證並回傳期間天數"""
    if days is None:
        return 365  # 預設 365 天
    if days not in ALLOWED_PERIOD_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"period_days 參數僅允許 {list(ALLOWED_PERIOD_DAYS)}，目前為 {days}",
        )
    return days


def _normalize_severity_levels(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    normalized = value.strip().upper()
    if not normalized:
        return None

    if not SEVERITY_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="severity_levels 參數格式錯誤（僅允許 A1/A2/A3，以逗號分隔）",
        )
    return normalized


def _serialize_hotspot(hotspot):
    """序列化熱點為 API 回應格式"""
    return {
        "id": str(hotspot.id),
        "center_latitude": float(hotspot.center_latitude),
        "center_longitude": float(hotspot.center_longitude),
        "radius_meters": hotspot.radius_meters,
        "total_accidents": hotspot.total_accidents,
        "a1_count": hotspot.a1_count,
        "a2_count": hotspot.a2_count,
        "a3_count": hotspot.a3_count,
        "earliest_accident_at": hotspot.earliest_accident_at.isoformat(),
        "latest_accident_at": hotspot.latest_accident_at.isoformat(),
        "analysis_period_days": hotspot.analysis_period_days,
        "severity_score": calculate_severity_score(hotspot),
    }


def _serialize_accident(accident: Accident):
    """序列化事故為 API 回應格式"""
    return {
        "id": str(accident.id),
        "severity": (
            accident.source_type.value
            if hasattr(accident.source_type, "value")
            else str(accident.source_type)
        ),
        "source_id": accident.source_id,
        "occurred_at": accident.occurred_at.isoformat(),
        "address": accident.location_text,
        "latitude": float(accident.latitude),
        "longitude": float(accident.longitude),
        "involved_vehicles": [accident.vehicle_type] if accident.vehicle_type else [],
        "involved_people": [],
        "description": None,
        "distance_meters": None,
    }


@router.get("/all")
async def get_all_hotspots(
    period_days: Optional[int] = Query(None, description="分析期間天數（30/90/180/365）"),
    severity_levels: Optional[str] = Query(None, description="嚴重程度篩選（逗號分隔，如 A1,A2）"),
    limit: int = Query(10000, description="最多回傳數量", ge=1, le=10000),
    db: Session = Depends(get_db),
):
    """
    取得所有事故熱點

    查詢指定分析期間的所有熱點，預設為 365 天。
    支援嚴重程度篩選。
    """
    try:
        validated_days = _validate_period_days(period_days)
        sanitized_severity = _normalize_severity_levels(severity_levels)

        logger.info(
            f"查詢所有熱點: period_days={validated_days}, "
            f"severity_levels={sanitized_severity}, limit={limit}"
        )

        hotspots = HotspotService.get_all(
            db=db,
            period_days=validated_days,
            severity_levels=sanitized_severity,
            limit=limit,
        )

        hotspot_data = [_serialize_hotspot(h) for h in hotspots]

        return {
            "data": hotspot_data,
            "meta": {
                "total_count": len(hotspot_data),
                "period_days": validated_days,
            },
        }
    except Exception as e:
        logger.error(f"查詢所有熱點失敗: {e}", exc_info=True)
        raise


@router.get("/{hotspot_id}")
async def get_hotspot_by_id(
    hotspot_id: str,
    include_accidents: bool = Query(False, description="是否包含事故記錄列表"),
    db: Session = Depends(get_db),
):
    """
    查詢單一熱點詳細資訊

    根據熱點ID查詢詳細資訊，可選擇包含該熱點的所有事故記錄。
    """
    logger.info(f"查詢熱點詳細資訊: hotspot_id={hotspot_id}, include_accidents={include_accidents}")

    # 驗證 UUID 格式
    try:
        uuid.UUID(hotspot_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="無效的 UUID 格式"
        )

    hotspot = HotspotService.get_by_id(db, hotspot_id)
    if not hotspot:
        raise NotFoundError("熱點", hotspot_id)

    result = {
        "id": str(hotspot.id),
        "center_latitude": float(hotspot.center_latitude),
        "center_longitude": float(hotspot.center_longitude),
        "radius_meters": hotspot.radius_meters,
        "total_accidents": hotspot.total_accidents,
        "a1_count": hotspot.a1_count,
        "a2_count": hotspot.a2_count,
        "a3_count": hotspot.a3_count,
        "earliest_accident_at": hotspot.earliest_accident_at.isoformat(),
        "latest_accident_at": hotspot.latest_accident_at.isoformat(),
        "analysis_date": hotspot.analysis_date.isoformat(),
        "analysis_period_days": hotspot.analysis_period_days,
        "analysis_period_start": hotspot.analysis_period_start.isoformat(),
        "analysis_period_end": hotspot.analysis_period_end.isoformat(),
        "severity_score": calculate_severity_score(hotspot),
    }

    if include_accidents:
        # 查詢熱點包含的事故記錄
        accidents = HotspotService.get_accidents_by_hotspot_id(db, hotspot_id)
        result["accidents"] = [_serialize_accident(acc) for acc in accidents]

    return {"data": result}
