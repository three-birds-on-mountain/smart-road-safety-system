"""API Response Caching：快取機制"""
from functools import wraps
from typing import Callable, Any, Optional
import hashlib
import json
from datetime import datetime, timedelta

from src.core.logging import get_logger

logger = get_logger(__name__)

# 簡單的記憶體快取（生產環境應使用 Redis）
_cache: dict[str, tuple[Any, datetime]] = {}


def cache_response(ttl_seconds: int = 300, key_prefix: str = ""):
    """
    API 回應快取裝飾器

    Args:
        ttl_seconds: 快取有效時間（秒）
        key_prefix: 快取鍵前綴
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # 產生快取鍵
            cache_key = _generate_cache_key(key_prefix, func.__name__, args, kwargs)

            # 檢查快取
            if cache_key in _cache:
                cached_value, cached_time = _cache[cache_key]
                if datetime.now() - cached_time < timedelta(seconds=ttl_seconds):
                    logger.debug(f"快取命中: {cache_key}")
                    return cached_value
                else:
                    # 過期，移除
                    del _cache[cache_key]

            # 執行函數
            result = await func(*args, **kwargs)

            # 儲存到快取
            _cache[cache_key] = (result, datetime.now())
            logger.debug(f"快取儲存: {cache_key}")

            return result

        return wrapper
    return decorator


def _generate_cache_key(prefix: str, func_name: str, args: tuple, kwargs: dict) -> str:
    """產生快取鍵"""
    key_data = {
        "prefix": prefix,
        "func": func_name,
        "args": str(args),
        "kwargs": json.dumps(kwargs, sort_keys=True),
    }
    key_string = json.dumps(key_data, sort_keys=True)
    return hashlib.md5(key_string.encode()).hexdigest()


def clear_cache(key_prefix: Optional[str] = None):
    """清除快取"""
    if key_prefix:
        keys_to_remove = [k for k in _cache.keys() if k.startswith(key_prefix)]
        for key in keys_to_remove:
            del _cache[key]
        logger.info(f"清除快取: {len(keys_to_remove)} 個鍵")
    else:
        _cache.clear()
        logger.info("清除所有快取")


def get_cache_stats() -> dict:
    """取得快取統計資訊"""
    return {
        "total_keys": len(_cache),
        "keys": list(_cache.keys()),
    }


