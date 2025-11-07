"""日誌設定：結構化日誌與請求耗時監控"""
import logging
import sys
from time import perf_counter
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


def setup_logging(log_level: str = "INFO") -> None:
    """設定結構化日誌"""
    # 設定日誌格式
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # 設定根日誌記錄器
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # 設定第三方套件日誌等級
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """取得日誌記錄器"""
    return logging.getLogger(name)


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """量測並記錄 HTTP 請求耗時的中介層"""

    def __init__(self, app) -> None:
        super().__init__(app)
        self.logger = logging.getLogger("api.request")

    async def dispatch(self, request: Request, call_next):
        start = perf_counter()
        response = await call_next(request)
        duration_ms = (perf_counter() - start) * 1000

        self.logger.info(
            "API 請求 %s %s 完成，狀態碼=%s，耗時=%.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Response-Time-ms"] = f"{duration_ms:.2f}"
        return response
