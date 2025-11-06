"""Geocoding Service：Google Maps API 整合"""
import httpx
from typing import Optional, Tuple
from decimal import Decimal
import asyncio

from src.core.config import get_settings
from src.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class GeocodingService:
    """地理編碼服務（A3資料地址轉換）"""

    def __init__(self, api_key: Optional[str] = None):
        """初始化服務"""
        self.api_key = api_key or settings.google_maps_api_key
        self.base_url = "https://maps.googleapis.com/maps/api/geocode/json"

    async def geocode(self, address: str) -> Optional[Tuple[float, float, float]]:
        """
        將地址轉換為經緯度

        Args:
            address: 地址字串

        Returns:
            (latitude, longitude, confidence) 或 None
            confidence: 0.0-1.0 的信心分數
        """
        if not self.api_key:
            logger.warning("Google Maps API key 未設定，無法進行地理編碼")
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {
                    "address": address,
                    "key": self.api_key,
                    "language": "zh-TW",
                    "region": "tw",
                }
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "OK" or not data.get("results"):
                    logger.warning(f"地理編碼失敗: {address}, status={data.get('status')}")
                    return None

                result = data["results"][0]
                location = result["geometry"]["location"]
                lat = float(location["lat"])
                lng = float(location["lng"])

                # 計算信心分數（基於 location_type）
                location_type = result["geometry"]["location_type"]
                confidence_map = {
                    "ROOFTOP": 1.0,
                    "RANGE_INTERPOLATED": 0.8,
                    "GEOMETRIC_CENTER": 0.6,
                    "APPROXIMATE": 0.4,
                }
                confidence = confidence_map.get(location_type, 0.5)

                logger.debug(f"地理編碼成功: {address} -> ({lat}, {lng}), confidence={confidence}")
                return (lat, lng, confidence)

        except Exception as e:
            logger.error(f"地理編碼錯誤: {address}, error={e}", exc_info=True)
            return None

    async def geocode_batch(
        self, addresses: list[str], delay: float = 0.1
    ) -> list[Optional[Tuple[float, float, float]]]:
        """
        批次地理編碼（避免 rate limiting）

        Args:
            addresses: 地址列表
            delay: 每次請求之間的延遲（秒）

        Returns:
            經緯度列表（對應順序）
        """
        results = []
        for i, address in enumerate(addresses):
            if i > 0:
                await asyncio.sleep(delay)  # 避免 rate limiting
            result = await self.geocode(address)
            results.append(result)
        return results
