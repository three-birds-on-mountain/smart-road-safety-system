"""Data Ingestion Service：A1/A2/A3 資料擷取"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import uuid
from decimal import Decimal

from src.models.accident import Accident
from src.models import SourceType, SeverityLevel
from src.services.geocoding import GeocodingService
from src.core.logging import get_logger

logger = get_logger(__name__)


class DataIngestionService:
    """資料擷取服務"""

    def __init__(self, db: Session, geocoding_service: Optional[GeocodingService] = None):
        """初始化服務"""
        self.db = db
        self.geocoding_service = geocoding_service or GeocodingService()

    async def ingest_a1(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> int:
        """
        擷取 A1 事故資料

        Args:
            start_date: 起始日期（ISO 8601格式）
            end_date: 結束日期（ISO 8601格式）

        Returns:
            擷取的資料筆數
        """
        logger.info(f"開始擷取 A1 資料: start_date={start_date}, end_date={end_date}")
        # TODO: 實作從政府 API 擷取 A1 資料的邏輯
        # 這裡是骨架實作，實際需要整合政府開放資料 API
        count = 0
        logger.info(f"A1 資料擷取完成: {count} 筆")
        return count

    async def ingest_a2(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> int:
        """
        擷取 A2 事故資料

        Args:
            start_date: 起始日期（ISO 8601格式）
            end_date: 結束日期（ISO 8601格式）

        Returns:
            擷取的資料筆數
        """
        logger.info(f"開始擷取 A2 資料: start_date={start_date}, end_date={end_date}")
        # TODO: 實作從政府 API 擷取 A2 資料的邏輯
        count = 0
        logger.info(f"A2 資料擷取完成: {count} 筆")
        return count

    async def ingest_a3(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> int:
        """
        擷取 A3 事故資料（需要地理編碼）

        Args:
            start_date: 起始日期（ISO 8601格式）
            end_date: 結束日期（ISO 8601格式）

        Returns:
            擷取的資料筆數
        """
        logger.info(f"開始擷取 A3 資料: start_date={start_date}, end_date={end_date}")
        # TODO: 實作從政府 API 擷取 A3 資料的邏輯
        # 並使用 geocoding_service 進行地址轉換
        count = 0
        logger.info(f"A3 資料擷取完成: {count} 筆")
        return count

    def _save_accident(
        self,
        source_type: SourceType,
        source_id: str,
        occurred_at: datetime,
        latitude: float,
        longitude: float,
        severity_level: SeverityLevel,
        location_text: Optional[str] = None,
        vehicle_type: Optional[str] = None,
        raw_data: Optional[Dict] = None,
        geocoded: bool = False,
        geocode_confidence: Optional[float] = None,
    ) -> Accident:
        """
        儲存事故記錄（內部方法）

        Returns:
            建立的事故記錄
        """
        # 檢查是否已存在（避免重複）
        existing = (
            self.db.query(Accident)
            .filter(
                and_(
                    Accident.source_type == source_type,
                    Accident.source_id == source_id,
                )
            )
            .first()
        )

        if existing:
            logger.debug(f"事故記錄已存在: {source_type}-{source_id}")
            return existing

        # 建立 PostGIS 地理點（使用 WKT 字串，PostGIS Trigger 會自動處理）
        from geoalchemy2 import WKTElement
        
        accident = Accident(
            id=uuid.uuid4(),
            source_type=source_type,
            source_id=source_id,
            occurred_at=occurred_at,
            latitude=Decimal(str(latitude)).quantize(Decimal("0.0000001")),
            longitude=Decimal(str(longitude)).quantize(Decimal("0.0000001")),
            geom=WKTElement(f"POINT({longitude} {latitude})", srid=4326),
            severity_level=severity_level,
            location_text=location_text,
            vehicle_type=vehicle_type,
            raw_data=raw_data,
            geocoded=geocoded,
            geocode_confidence=Decimal(str(geocode_confidence)).quantize(Decimal("0.01")) if geocode_confidence else None,
        )

        self.db.add(accident)
        return accident

    def _deduplicate_accidents(self) -> int:
        """
        資料去重邏輯（移除重複的事故記錄）

        Returns:
            移除的重複記錄數
        """
        # TODO: 實作去重邏輯
        # 基於 source_type + source_id 的唯一性約束，重複記錄會被拒絕
        return 0

    async def ingest_all(
        self, source_types: Optional[List[str]] = None, force_refresh: bool = False
    ) -> dict:
        """
        擷取所有資料來源

        Args:
            source_types: 要擷取的來源類型列表（預設：全部）
            force_refresh: 是否強制重新擷取已存在的資料

        Returns:
            各來源的擷取結果
        """
        logger.info(f"開始完整資料擷取: source_types={source_types}, force_refresh={force_refresh}")

        if source_types is None:
            source_types = ["A1", "A2", "A3"]

        results = {}
        end_date = datetime.now().date().isoformat()
        start_date = (datetime.now() - timedelta(days=30)).date().isoformat()

        try:
            if "A1" in source_types:
                results["A1"] = await self.ingest_a1(start_date=start_date, end_date=end_date)

            if "A2" in source_types:
                results["A2"] = await self.ingest_a2(start_date=start_date, end_date=end_date)

            if "A3" in source_types:
                results["A3"] = await self.ingest_a3(start_date=start_date, end_date=end_date)

            # 執行去重
            duplicates_removed = self._deduplicate_accidents()

            self.db.commit()
            logger.info(f"資料擷取完成: {results}, 移除重複記錄 {duplicates_removed} 筆")

            return {
                "results": results,
                "duplicates_removed": duplicates_removed,
                "total_ingested": sum(results.values()),
            }

        except Exception as e:
            self.db.rollback()
            logger.error(f"資料擷取失敗: {e}", exc_info=True)
            raise
