"""API 路由結構"""
from fastapi import APIRouter

api_router = APIRouter()

# 匯入路由模組（避免循環引用）
from src.api import health, hotspots, accidents, admin

# 註冊路由
api_router.include_router(health.router, tags=["system"])
api_router.include_router(hotspots.router, prefix="/hotspots", tags=["hotspots"])
api_router.include_router(accidents.router, prefix="/accidents", tags=["accidents"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

