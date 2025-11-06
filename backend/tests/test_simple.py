"""簡單測試，用於驗證測試環境"""
import pytest


def test_simple():
    """簡單測試，不依賴任何外部資源"""
    assert 1 + 1 == 2


def test_import():
    """測試導入模組"""
    from src.services.hotspot_service import calculate_severity_score
    assert callable(calculate_severity_score)

