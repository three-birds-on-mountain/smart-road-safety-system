"""錯誤處理中介層：統一錯誤格式"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger(__name__)


class AppError(Exception):
    """應用程式自訂錯誤"""

    def __init__(self, message: str, error_code: str = "app_error", status_code: int = 500):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """處理應用程式自訂錯誤"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
        },
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """處理請求驗證錯誤"""
    errors = {}
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors[field] = error["msg"]

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "message": "請求參數不正確",
            "details": errors,
        },
    )


async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """處理資料庫錯誤"""
    logger.error(f"資料庫錯誤: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "database_error",
            "message": "資料庫操作失敗",
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """處理一般例外"""
    logger.error(f"未處理的例外: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_error",
            "message": "伺服器處理請求時發生錯誤",
        },
    )


class NotFoundError(AppError):
    """資源不存在錯誤"""

    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            message=f"找不到指定的{resource}記錄",
            error_code="not_found",
            status_code=404,
        )
        self.resource = resource
        self.resource_id = resource_id


class BadRequestError(AppError):
    """請求參數錯誤"""

    def __init__(self, message: str):
        super().__init__(message=message, error_code="validation_error", status_code=400)


class UnauthorizedError(AppError):
    """未授權錯誤"""

    def __init__(self, message: str = "此端點需要管理員權限"):
        super().__init__(message=message, error_code="unauthorized", status_code=401)

