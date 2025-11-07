"""核心設定模組：環境變數管理"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """應用程式設定"""

    # 資料庫設定
    database_url: str = "postgresql://postgres:postgres@localhost:5432/road_safety_db"

    # Google Maps API 設定
    google_maps_api_key: str = ""
    admin_jwt_secret: str = "change-me"
    admin_jwt_algorithm: str = "HS256"

    # 應用程式設定
    environment: str = "development"
    log_level: str = "INFO"

    # API 設定
    api_v1_prefix: str = "/api/v1"

    # Pydantic v2 配置方式
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",  # 忽略額外的環境變數
    )


@lru_cache()
def get_settings() -> Settings:
    """取得設定單例"""
    return Settings()
