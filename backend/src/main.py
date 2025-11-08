"""FastAPI 應用程式主檔：app instance, CORS 設定"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from src.core.config import get_settings
from src.core.errors import (
    AppError,
    app_error_handler,
    validation_error_handler,
    sqlalchemy_error_handler,
    generic_exception_handler,
)
from src.core.logging import RequestTimingMiddleware, setup_logging
from src.core.middleware import RateLimitMiddleware
from src.api import api_router
from sqlalchemy.exc import SQLAlchemyError

settings = get_settings()

# 設定日誌
setup_logging(settings.log_level)

# 建立 FastAPI 應用程式
app = FastAPI(
    title="智慧道路守護系統 API",
    description="提供交通事故熱點查詢與管理功能的RESTful API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "system", "description": "系統相關端點"},
        {"name": "hotspots", "description": "事故熱點查詢相關操作"},
        {"name": "accidents", "description": "事故記錄查詢相關操作（管理用途）"},
        {"name": "admin", "description": "管理端點（需要認證）"},
    ],
)

# 設定 CORS
origins = settings.cors_origins.split(",") if settings.cors_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 設定速率限制（每分鐘 60 個請求）
app.add_middleware(RateLimitMiddleware, requests_per_minute=60, burst_size=10)
# 記錄請求耗時
app.add_middleware(RequestTimingMiddleware)

# 註冊錯誤處理器
from fastapi.exceptions import HTTPException

async def http_exception_handler(request, exc: HTTPException):
    """處理 HTTPException"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail} if isinstance(exc.detail, str) else exc.detail,
    )

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# 註冊 API 路由
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root():
    """根路徑"""
    return {"message": "智慧道路守護系統 API", "version": "1.0.0"}
