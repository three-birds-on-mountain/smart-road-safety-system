"""API Rate Limiting：請求速率限制"""
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
from datetime import datetime, timedelta
from collections import defaultdict
import time

from src.core.logging import get_logger

logger = get_logger(__name__)

# 簡單的記憶體速率限制器（生產環境應使用 Redis）
_rate_limits: dict[str, list[datetime]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """API 速率限制中介層"""

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_size: int = 10,
    ):
        """
        初始化速率限制中介層

        Args:
            app: FastAPI 應用程式
            requests_per_minute: 每分鐘允許的請求數
            burst_size: 突發請求允許的數量
        """
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size

    async def dispatch(self, request: Request, call_next: Callable):
        """處理請求"""
        # 取得客戶端識別碼（IP 地址）
        client_id = request.client.host if request.client else "unknown"

        # 檢查速率限制
        if not self._check_rate_limit(client_id):
            logger.warning(f"速率限制觸發: client_id={client_id}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="請求過於頻繁，請稍後再試",
            )

        # 記錄請求時間
        _rate_limits[client_id].append(datetime.now())

        # 執行請求
        response = await call_next(request)
        return response

    def _check_rate_limit(self, client_id: str) -> bool:
        """檢查是否超過速率限制"""
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)

        # 清理過期的記錄
        _rate_limits[client_id] = [
            req_time for req_time in _rate_limits[client_id] if req_time > minute_ago
        ]

        # 檢查速率限制
        request_count = len(_rate_limits[client_id])
        if request_count >= self.requests_per_minute:
            return False

        return True


def create_rate_limit_middleware(requests_per_minute: int = 60, burst_size: int = 10):
    """建立速率限制中介層工廠函數"""
    def middleware(app):
        return RateLimitMiddleware(app, requests_per_minute, burst_size)
    return middleware


