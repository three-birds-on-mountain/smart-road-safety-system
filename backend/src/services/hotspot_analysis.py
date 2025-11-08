"""Hotspot Analysis Service：DBSCAN 聚類分析"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Dict
from datetime import datetime, timedelta, date
from decimal import Decimal
import uuid
import json

from sklearn.cluster import DBSCAN
import numpy as np
from geopy.distance import geodesic

from src.models.accident import Accident
from src.models.hotspot import Hotspot
from src.models import SourceType
from src.core.logging import get_logger

logger = get_logger(__name__)


class HotspotAnalysisService:
    """熱點分析服務（DBSCAN）"""

    def __init__(self, db: Session):
        """初始化服務"""
        self.db = db

    def analyze(
        self,
        analysis_period_days: int = 365,
        epsilon_meters: int = 500,
        min_samples: int = 5,
    ) -> int:
        """
        執行 DBSCAN 聚類分析，識別事故熱點

        Args:
            analysis_period_days: 分析過去幾天的事故資料（預設：365天）
            epsilon_meters: DBSCAN epsilon參數（公尺）
            min_samples: DBSCAN min_samples參數（最小事故數）

        Returns:
            產生的熱點數量
        """
        logger.info(
            f"開始熱點分析: period_days={analysis_period_days}, "
            f"epsilon={epsilon_meters}m, min_samples={min_samples}"
        )

        # 查詢過去指定天數內的事故
        cutoff_date = datetime.utcnow() - timedelta(days=analysis_period_days)
        accidents = (
            self.db.query(Accident)
            .filter(Accident.occurred_at >= cutoff_date)
            .all()
        )

        if len(accidents) < min_samples:
            logger.warning(f"事故數量不足: {len(accidents)} < {min_samples}")
            return 0

        # 準備座標資料（轉換為 numpy array）
        coordinates = np.array([
            [float(acc.latitude), float(acc.longitude)] for acc in accidents
        ])

        # 執行 DBSCAN（使用 haversine 距離）
        # epsilon 轉換為度數（約略：1度 ≈ 111公里）
        epsilon_degrees = epsilon_meters / 111000.0

        dbscan = DBSCAN(
            eps=epsilon_degrees,
            min_samples=min_samples,
            metric="haversine",
            algorithm="ball_tree",
        )
        labels = dbscan.fit_predict(np.radians(coordinates))

        # 處理聚類結果
        unique_labels = set(labels)
        if -1 in unique_labels:
            unique_labels.remove(-1)  # 移除噪音點

        analysis_date = date.today()
        analysis_period_start = cutoff_date.date()
        analysis_period_end = date.today() - timedelta(days=1)

        hotspot_count = 0
        for label in unique_labels:
            cluster_mask = labels == label
            cluster_accidents = [accidents[i] for i in range(len(accidents)) if cluster_mask[i]]

            if len(cluster_accidents) < min_samples:
                continue

            # 計算熱點統計
            stats = self.calculate_hotspot_stats([str(acc.id) for acc in cluster_accidents])

            # 計算中心點和半徑
            cluster_coords = [(float(acc.latitude), float(acc.longitude)) for acc in cluster_accidents]
            center_lat, center_lng = self.calculate_hotspot_center(cluster_coords)
            radius = self.calculate_hotspot_radius(cluster_coords, (center_lat, center_lng))

            # 建立熱點記錄
            from geoalchemy2 import WKTElement
            
            hotspot = Hotspot(
                id=uuid.uuid4(),
                center_latitude=Decimal(str(center_lat)).quantize(Decimal("0.0000001")),
                center_longitude=Decimal(str(center_lng)).quantize(Decimal("0.0000001")),
                geom=WKTElement(f"POINT({center_lng} {center_lat})", srid=4326),
                radius_meters=radius,
                total_accidents=stats["total_accidents"],
                a1_count=stats["a1_count"],
                a2_count=stats["a2_count"],
                a3_count=stats["a3_count"],
                earliest_accident_at=stats["earliest_accident_at"],
                latest_accident_at=stats["latest_accident_at"],
                analysis_date=analysis_date,
                analysis_period_start=analysis_period_start,
                analysis_period_end=analysis_period_end,
                accident_ids=json.dumps([str(acc.id) for acc in cluster_accidents]),
            )

            self.db.add(hotspot)
            hotspot_count += 1

        self.db.commit()
        logger.info(f"熱點分析完成: 產生 {hotspot_count} 個熱點")
        return hotspot_count

    def calculate_hotspot_stats(self, accident_ids: List[str]) -> Dict:
        """
        計算熱點統計資訊

        Args:
            accident_ids: 事故ID列表

        Returns:
            統計資訊
        """
        accidents = self.db.query(Accident).filter(Accident.id.in_(accident_ids)).all()

        # 從 source_type 推斷事故嚴重程度（A1/A2/A3）
        a1_count = sum(1 for acc in accidents if acc.source_type == SourceType.A1)
        a2_count = sum(1 for acc in accidents if acc.source_type == SourceType.A2)
        a3_count = sum(1 for acc in accidents if acc.source_type == SourceType.A3)

        occurred_times = [acc.occurred_at for acc in accidents]
        earliest = min(occurred_times)
        latest = max(occurred_times)

        return {
            "total_accidents": len(accidents),
            "a1_count": a1_count,
            "a2_count": a2_count,
            "a3_count": a3_count,
            "earliest_accident_at": earliest,
            "latest_accident_at": latest,
        }

    def calculate_hotspot_center(self, coordinates: List[tuple[float, float]]) -> tuple[float, float]:
        """
        計算熱點中心點（使用幾何平均）

        Args:
            coordinates: 座標列表 [(lat, lng), ...]

        Returns:
            (center_lat, center_lng)
        """
        if not coordinates:
            raise ValueError("座標列表不能為空")

        # 簡單的平均值（對於小範圍區域足夠準確）
        lats = [coord[0] for coord in coordinates]
        lngs = [coord[1] for coord in coordinates]
        return (sum(lats) / len(lats), sum(lngs) / len(lngs))

    def calculate_hotspot_radius(
        self, coordinates: List[tuple[float, float]], center: tuple[float, float]
    ) -> int:
        """
        計算熱點影響半徑（公尺）

        Args:
            coordinates: 座標列表
            center: 中心點座標

        Returns:
            半徑（公尺）
        """
        if not coordinates:
            return 100  # 預設半徑

        # 計算所有點到中心的距離，取最大值
        max_distance = 0
        for coord in coordinates:
            distance = geodesic(center, coord).meters
            max_distance = max(max_distance, distance)

        # 加上緩衝區（20%）
        radius = int(max_distance * 1.2)
        # 限制在半徑範圍內（50-2000公尺）
        return max(50, min(2000, radius))
