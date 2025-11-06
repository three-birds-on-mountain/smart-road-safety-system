"""Pytest 共用配置和 fixture"""
import pytest
import os
import sys

# ⚠️ 重要：只在測試環境中設定測試資料庫 URL
# 這個檔案只應該在執行 pytest 時被導入，不應該影響正式服務

# 檢查是否在測試環境中（pytest 會設定這個環境變數）
# 或者檢查是否在 pytest 執行過程中
_is_pytest_running = (
    "pytest" in sys.modules or 
    "PYTEST_CURRENT_TEST" in os.environ or
    any("pytest" in arg for arg in sys.argv)
)

if _is_pytest_running:
    # 只在測試環境中設定測試資料庫
    # 優先使用 TEST_DATABASE_URL，如果沒有則使用預設測試資料庫
    # 在 Docker Compose 環境中，使用 postgres 服務名稱
    # 在本地環境中，使用 localhost
    if os.path.exists("/.dockerenv") or os.environ.get("DOCKER_CONTAINER"):
        DEFAULT_TEST_DB = "postgresql://postgres:postgres@postgres:5432/road_safety_db_test"
    else:
        DEFAULT_TEST_DB = "postgresql://postgres:postgres@localhost:5432/road_safety_db_test"
    
    TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DB)
    
    # 只有在測試環境中才覆蓋 DATABASE_URL
    # 如果 DATABASE_URL 已經設定且不是測試資料庫，則不覆蓋
    if "DATABASE_URL" not in os.environ or "test" in os.environ.get("DATABASE_URL", "").lower():
        os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    
    # 驗證測試資料庫 URL（避免意外使用正式資料庫）
    if "road_safety_db_test" not in TEST_DATABASE_URL and "test" not in TEST_DATABASE_URL.lower():
        import warnings
        warnings.warn(
            f"⚠️  警告：測試資料庫 URL 不包含 'test'，可能使用到正式資料庫！\n"
            f"目前 URL: {TEST_DATABASE_URL}\n"
            f"請確認這是預期的行為。",
            UserWarning
        )
    
    # 清除已導入模組的快取（如果有的話）
    # 這確保在設定環境變數後，重新導入的模組會使用新的環境變數
    if "src.core.config" in sys.modules:
        from src.core.config import get_settings
        get_settings.cache_clear()

