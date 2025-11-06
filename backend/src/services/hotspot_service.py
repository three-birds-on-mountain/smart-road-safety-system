"""Hotspot Service：熱點查詢服務"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, text
from geoalchemy2 import Geography
from geoalchemy2.functions import (
    ST_DWithin,
    ST_Distance,
    ST_SetSRID,
    ST_MakePoint,
    ST_MakeEnvelope,
)
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal

from src.models.hotspot import Hotspot
from src.models import SeverityLevel
from src.core.errors import BadRequestError


class HotspotService:
    """熱點服務"""

    @staticmethod
    def get_nearby(
        db: Session,
        latitude: float,
        longitude: float,
        distance: int,
        time_range: Optional[str] = None,
        severity_levels: Optional[str] = None,
    ) -> List[Hotspot]:
        """
        查詢用戶附近的熱點

        Args:
            db: 資料庫連線
            latitude: 用戶緯度
            longitude: 用戶經度
            distance: 查詢半徑（公尺）
            time_range: 時間範圍（1_month, 3_months, 6_months, 1_year）
            severity_levels: 嚴重程度篩選（逗號分隔，如 "A1,A2"）

        Returns:
            熱點列表（已按距離排序）
        """
        # 驗證經緯度範圍
        if not (21.5 <= latitude <= 25.5):
            raise BadRequestError("緯度必須介於 21.5 到 25.5 之間")
        if not (119.5 <= longitude <= 122.5):
            raise BadRequestError("經度必須介於 119.5 到 122.5 之間")

        # 建立用戶位置點（使用 PostGIS 函式）
        user_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

        # 建立查詢
        query = db.query(Hotspot).filter(
            ST_DWithin(
                Hotspot.geom,
                user_point.cast(Geography),
                distance,
            )
        )

        # 時間範圍篩選
        if time_range:
            cutoff_date = _parse_time_range(time_range)
            query = query.filter(Hotspot.latest_accident_at >= cutoff_date)

        # 嚴重程度篩選
        if severity_levels:
            levels = [s.strip() for s in severity_levels.split(",")]
            conditions = []
            if "A1" in levels:
                conditions.append(Hotspot.a1_count > 0)
            if "A2" in levels:
                conditions.append(Hotspot.a2_count > 0)
            if "A3" in levels:
                conditions.append(Hotspot.a3_count > 0)
            if conditions:
                query = query.filter(or_(*conditions))

        # 只查詢最新的分析結果
        latest_analysis_date = db.query(func.max(Hotspot.analysis_date)).scalar()
        if latest_analysis_date:
            query = query.filter(Hotspot.analysis_date == latest_analysis_date)

        # 計算距離並排序
        query = query.add_columns(
            ST_Distance(
                Hotspot.geom,
                user_point.cast(Geography),
            ).label("distance_meters")
        ).order_by("distance_meters")

        results = query.all()
        hotspots = [row[0] for row in results]  # 只回傳 Hotspot 物件
        
        # 合併重疊的熱點
        merged_hotspots = HotspotService.merge_overlapping_hotspots(db, hotspots)
        
        return merged_hotspots

    @staticmethod
    def get_in_bounds(
        db: Session,
        sw_lat: float,
        sw_lng: float,
        ne_lat: float,
        ne_lng: float,
        time_range: Optional[str] = None,
        severity_levels: Optional[str] = None,
        limit: int = 500,
    ) -> List[Hotspot]:
        """
        查詢地圖可視範圍內的熱點

        Args:
            db: 資料庫連線
            sw_lat: 西南角緯度
            sw_lng: 西南角經度
            ne_lat: 東北角緯度
            ne_lng: 東北角經度
            time_range: 時間範圍
            severity_levels: 嚴重程度篩選
            limit: 最多回傳數量

        Returns:
            熱點列表（按事故數排序）
        """
        # 建立邊界矩形
        bounds = ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)

        query = db.query(Hotspot).filter(
            Hotspot.geom.intersects(bounds.cast(Geography))
        )

        # 時間範圍篩選
        if time_range:
            cutoff_date = _parse_time_range(time_range)
            query = query.filter(Hotspot.latest_accident_at >= cutoff_date)

        # 嚴重程度篩選
        if severity_levels:
            levels = [s.strip() for s in severity_levels.split(",")]
            conditions = []
            if "A1" in levels:
                conditions.append(Hotspot.a1_count > 0)
            if "A2" in levels:
                conditions.append(Hotspot.a2_count > 0)
            if "A3" in levels:
                conditions.append(Hotspot.a3_count > 0)
            if conditions:
                query = query.filter(or_(*conditions))

        # 只查詢最新的分析結果
        latest_analysis_date = db.query(func.max(Hotspot.analysis_date)).scalar()
        if latest_analysis_date:
            query = query.filter(Hotspot.analysis_date == latest_analysis_date)

        # 按事故數排序
        query = query.order_by(Hotspot.total_accidents.desc()).limit(limit)

        return query.all()

    @staticmethod
    def get_by_id(db: Session, hotspot_id: str) -> Optional[Hotspot]:
        """根據 ID 查詢熱點"""
        import uuid
        # 驗證 UUID 格式
        try:
            uuid.UUID(hotspot_id)
        except ValueError:
            return None  # 無效的 UUID 格式，直接回傳 None
        
        return db.query(Hotspot).filter(Hotspot.id == hotspot_id).first()

    @staticmethod
    def merge_overlapping_hotspots(
        db: Session,
        hotspots: List[Hotspot],
        overlap_threshold_meters: int = 100,
    ) -> List[Hotspot]:
        """
        合併重疊的熱點
        
        當多個熱點的中心點距離小於 threshold 時，合併為一個熱點。
        合併後的熱點統計資訊會累加，半徑會取最大值。
        
        Args:
            db: 資料庫連線
            hotspots: 熱點列表
            overlap_threshold_meters: 重疊閾值（公尺）
        
        Returns:
            合併後的熱點列表
        """
        if not hotspots:
            return []
        
        # 使用簡單的距離計算來判斷重疊
        merged = []
        used = set()
        
        for i, hotspot1 in enumerate(hotspots):
            if i in used:
                continue
            
            # 尋找與當前熱點重疊的其他熱點
            cluster = [hotspot1]
            for j, hotspot2 in enumerate(hotspots[i+1:], start=i+1):
                if j in used:
                    continue
                
                # 計算兩個熱點中心點的距離
                from geopy.distance import geodesic
                distance = geodesic(
                    (float(hotspot1.center_latitude), float(hotspot1.center_longitude)),
                    (float(hotspot2.center_latitude), float(hotspot2.center_longitude))
                ).meters
                
                if distance < overlap_threshold_meters:
                    cluster.append(hotspot2)
                    used.add(j)
            
            # 如果只有一個熱點，直接加入
            if len(cluster) == 1:
                merged.append(hotspot1)
            else:
                # 合併多個熱點
                merged_hotspot = _merge_hotspot_cluster(cluster)
                merged.append(merged_hotspot)
            
            used.add(i)
        
        return merged


def _merge_hotspot_cluster(cluster: List[Hotspot]) -> Hotspot:
    """
    合併一個熱點聚類
    
    Args:
        cluster: 要合併的熱點列表
    
    Returns:
        合併後的熱點（新實例，未儲存到資料庫）
    """
    if len(cluster) == 1:
        return cluster[0]
    
    # 計算合併後的中心點（加權平均，以事故數為權重）
    total_weight = sum(h.total_accidents for h in cluster)
    if total_weight == 0:
        total_weight = len(cluster)
    
    center_lat = sum(float(h.center_latitude) * h.total_accidents for h in cluster) / total_weight
    center_lng = sum(float(h.center_longitude) * h.total_accidents for h in cluster) / total_weight
    
    # 合併統計資訊
    total_accidents = sum(h.total_accidents for h in cluster)
    a1_count = sum(h.a1_count for h in cluster)
    a2_count = sum(h.a2_count for h in cluster)
    a3_count = sum(h.a3_count for h in cluster)
    
    # 時間範圍
    earliest = min(h.earliest_accident_at for h in cluster)
    latest = max(h.latest_accident_at for h in cluster)
    
    # 半徑取最大值
    max_radius = max(h.radius_meters for h in cluster)
    
    # 合併事故 ID 列表
    import json
    all_accident_ids = []
    for h in cluster:
        if h.accident_ids:
            ids = json.loads(h.accident_ids) if isinstance(h.accident_ids, str) else h.accident_ids
            all_accident_ids.extend(ids)
    
    # 建立合併後的熱點（使用第一個熱點的其他屬性）
    from geoalchemy2 import WKTElement
    from datetime import date
    from decimal import Decimal
    
    merged = Hotspot(
        id=cluster[0].id,  # 使用第一個熱點的 ID
        center_latitude=Decimal(str(center_lat)).quantize(Decimal("0.0000001")),
        center_longitude=Decimal(str(center_lng)).quantize(Decimal("0.0000001")),
        geom=WKTElement(f"POINT({center_lng} {center_lat})", srid=4326),
        radius_meters=max_radius,
        total_accidents=total_accidents,
        a1_count=a1_count,
        a2_count=a2_count,
        a3_count=a3_count,
        earliest_accident_at=earliest,
        latest_accident_at=latest,
        analysis_date=cluster[0].analysis_date,
        analysis_period_start=cluster[0].analysis_period_start,
        analysis_period_end=cluster[0].analysis_period_end,
        accident_ids=json.dumps(all_accident_ids),
    )
    
    return merged


def _parse_time_range(time_range: str) -> datetime:
    """解析時間範圍字串"""
    from datetime import timezone
    now = datetime.now(timezone.utc)
    if time_range == "1_month":
        return now - timedelta(days=30)
    elif time_range == "3_months":
        return now - timedelta(days=90)
    elif time_range == "6_months":
        return now - timedelta(days=180)
    elif time_range == "1_year":
        return now - timedelta(days=365)
    else:
        return now - timedelta(days=365)  # 預設一年


def calculate_severity_score(hotspot: Hotspot) -> float:
    """計算嚴重程度分數（加權：A1=5, A2=3, A3=1）"""
    return float(hotspot.a1_count * 5 + hotspot.a2_count * 3 + hotspot.a3_count * 1)

