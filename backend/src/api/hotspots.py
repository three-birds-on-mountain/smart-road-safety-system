"""熱點查詢API"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import re

from geopy.distance import geodesic

from src.db.session import get_db
from src.core.errors import BadRequestError
from src.core.logging import get_logger
from src.services.hotspot_service import HotspotService, calculate_severity_score

logger = get_logger(__name__)
router = APIRouter()

ALLOWED_DISTANCES = (100, 500, 1000, 3000)
ALLOWED_TIME_RANGES = ("1_month", "3_months", "6_months", "1_year")
SEVERITY_PATTERN = re.compile(r"^(A1|A2|A3)(,(A1|A2|A3))*$")


def _validate_distance(distance: int) -> None:
    if distance not in ALLOWED_DISTANCES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"distance 參數僅允許 {list(ALLOWED_DISTANCES)}，目前為 {distance}",
        )


def _validate_time_range(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if value not in ALLOWED_TIME_RANGES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="time_range 參數僅允許 ['1_month', '3_months', '6_months', '1_year']",
        )
    return value


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


def _serialize_hotspot(hotspot, *, distance: Optional[float] = None):
    payload = {
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
        "severity_score": calculate_severity_score(hotspot),
    }

    if distance is not None:
        payload["distance_from_user_meters"] = round(distance, 2)

    return payload


@router.get("/all")
async def get_all_hotspots(
    limit: int = Query(10000, description="最多回傳數量", ge=1, le=10000),
    db: Session = Depends(get_db),
):
    """
    取得所有事故熱點

    一次性取得所有熱點資料，用於前端快取。
    不含時間範圍和嚴重程度篩選，前端自行過濾。
    """
    try:
        logger.info(f"查詢所有熱點，limit={limit}")

        # 查詢所有熱點
        hotspots = HotspotService.get_all(db=db, limit=limit)

        # 轉換為回應格式
        hotspot_data = [_serialize_hotspot(hotspot) for hotspot in hotspots]

        return {
            "data": hotspot_data,
            "meta": {
                "total_count": len(hotspot_data),
            },
        }
    except Exception as e:
        logger.error(f"查詢所有熱點失敗: {e}", exc_info=True)
        raise


@router.get("/nearby")
async def get_nearby_hotspots(
    latitude: float = Query(..., description="用戶當前緯度", ge=21.5, le=25.5),
    longitude: float = Query(..., description="用戶當前經度", ge=119.5, le=122.5),
    distance: int = Query(..., description="查詢半徑（公尺）", enum=ALLOWED_DISTANCES),
    time_range: Optional[str] = Query(None, description="時間範圍", enum=ALLOWED_TIME_RANGES),
    severity_levels: Optional[str] = Query(None, description="嚴重程度篩選（逗號分隔）"),
    db: Session = Depends(get_db),
):
    """
    查詢用戶附近的事故熱點

    根據用戶的GPS位置，查詢指定距離內的事故熱點。
    支援時間範圍、事故嚴重程度篩選。
    """
    _validate_distance(distance)
    sanitized_time_range = _validate_time_range(time_range)
    sanitized_severity = _normalize_severity_levels(severity_levels)
    
    try:
        logger.info(
            f"查詢附近熱點: lat={latitude}, lng={longitude}, distance={distance}m, "
            f"time_range={sanitized_time_range}, severity_levels={sanitized_severity}"
        )

        # 查詢熱點
        hotspots = HotspotService.get_nearby(
            db=db,
            latitude=latitude,
            longitude=longitude,
            distance=distance,
            time_range=sanitized_time_range,
            severity_levels=sanitized_severity,
        )

        # 轉換為回應格式
        hotspot_data = []
        for hotspot in hotspots:
            distance_meters = geodesic(
                (latitude, longitude),
                (float(hotspot.center_latitude), float(hotspot.center_longitude)),
            ).meters

            hotspot_data.append(_serialize_hotspot(hotspot, distance=distance_meters))

        return {
            "data": hotspot_data,
            "meta": {
                "total_count": len(hotspot_data),
                "user_location": {
                    "latitude": latitude,
                    "longitude": longitude,
                },
                "query_radius_meters": distance,
            },
        }
    except BadRequestError as e:
        logger.warning(f"請求參數錯誤: {e.message}")
        raise
    except Exception as e:
        logger.error(f"查詢附近熱點失敗: {e}", exc_info=True)
        raise


@router.get("/in-bounds")
async def get_hotspots_in_bounds(
    sw_lat: float = Query(..., description="西南角緯度"),
    sw_lng: float = Query(..., description="西南角經度"),
    ne_lat: float = Query(..., description="東北角緯度"),
    ne_lng: float = Query(..., description="東北角經度"),
    time_range: Optional[str] = Query(None, description="時間範圍", enum=ALLOWED_TIME_RANGES),
    severity_levels: Optional[str] = Query(None, description="嚴重程度篩選（逗號分隔）"),
    limit: int = Query(500, description="最多回傳數量", ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    查詢地圖可視範圍內的熱點

    根據地圖的邊界座標（西南角與東北角），查詢範圍內的所有熱點。
    """
    try:
        sanitized_time_range = _validate_time_range(time_range)
        sanitized_severity = _normalize_severity_levels(severity_levels)

        logger.info(
            f"查詢範圍內熱點: sw=({sw_lat}, {sw_lng}), ne=({ne_lat}, {ne_lng}), "
            f"time_range={sanitized_time_range}, severity_levels={sanitized_severity}, limit={limit}"
        )

        hotspots = HotspotService.get_in_bounds(
            db=db,
            sw_lat=sw_lat,
            sw_lng=sw_lng,
            ne_lat=ne_lat,
            ne_lng=ne_lng,
            time_range=sanitized_time_range,
            severity_levels=sanitized_severity,
            limit=limit,
        )

        hotspot_data = []
        for hotspot in hotspots:
            hotspot_data.append(_serialize_hotspot(hotspot))

        return {
            "data": hotspot_data,
            "meta": {
                "total_count": len(hotspot_data),
                "bounds": {
                    "sw_lat": sw_lat,
                    "sw_lng": sw_lng,
                    "ne_lat": ne_lat,
                    "ne_lng": ne_lng,
                },
            },
        }
    except Exception as e:
        logger.error(f"查詢範圍內熱點失敗: {e}", exc_info=True)
        raise


@router.get("/{hotspot_id}")
async def get_hotspot_by_id(
    hotspot_id: str,
    include_accidents: bool = Query(False, description="是否包含事故記錄列表"),
    db: Session = Depends(get_db),
):
    """
    查詢單一熱點詳細資訊

    根據熱點ID查詢詳細資訊，包含包含的事故記錄。
    """
    from src.core.errors import NotFoundError
    from fastapi import status

    logger.info(f"查詢熱點詳細資訊: hotspot_id={hotspot_id}, include_accidents={include_accidents}")

    # 驗證 UUID 格式
    try:
        uuid.UUID(hotspot_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="無效的 UUID 格式"
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
        "analysis_period_start": hotspot.analysis_period_start.isoformat(),
        "analysis_period_end": hotspot.analysis_period_end.isoformat(),
    }

    if include_accidents:
        # TODO: 實作查詢熱點包含的事故記錄
        result["accidents"] = []

    return {"data": result}
