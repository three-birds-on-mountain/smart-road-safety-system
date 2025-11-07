"""測試管理端點"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from src.api.admin import require_admin
from src.core.errors import UnauthorizedError
from src.core.auth import encode_hs256_jwt


def test_require_admin_with_valid_token():
    """測試有效的管理員 token"""
    secret = "test-secret"
    payload = {"user_id": "123", "role": "admin", "scope": "admin"}
    token = encode_hs256_jwt(payload, secret)

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with patch("src.api.admin.settings") as mock_settings:
        mock_settings.admin_jwt_secret = secret
        result = require_admin(credentials)

    assert result["role"] == "admin"
    assert result["user_id"] == "123"


def test_require_admin_with_scope_admin():
    """測試 scope 包含 admin 的 token"""
    secret = "test-secret"
    payload = {"user_id": "123", "role": "user", "scope": "read write admin"}
    token = encode_hs256_jwt(payload, secret)

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with patch("src.api.admin.settings") as mock_settings:
        mock_settings.admin_jwt_secret = secret
        result = require_admin(credentials)

    assert result["scope"] == "read write admin"


def test_require_admin_without_credentials():
    """測試沒有提供 credentials"""
    with pytest.raises(UnauthorizedError, match="此端點需要 Bearer Token"):
        require_admin(None)


def test_require_admin_with_wrong_scheme():
    """測試錯誤的認證方案"""
    credentials = HTTPAuthorizationCredentials(scheme="Basic", credentials="test")

    with pytest.raises(UnauthorizedError, match="此端點需要 Bearer Token"):
        require_admin(credentials)


def test_require_admin_without_admin_role():
    """測試沒有管理員權限的 token"""
    secret = "test-secret"
    payload = {"user_id": "123", "role": "user", "scope": "read write"}
    token = encode_hs256_jwt(payload, secret)

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with patch("src.api.admin.settings") as mock_settings:
        mock_settings.admin_jwt_secret = secret

        with pytest.raises(UnauthorizedError, match="此端點需要管理員權限"):
            require_admin(credentials)


def test_require_admin_with_invalid_token():
    """測試無效的 token"""
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="invalid.token.here"
    )

    with patch("src.api.admin.settings") as mock_settings:
        mock_settings.admin_jwt_secret = "secret"

        # 可能觸發 UnauthorizedError 或 UnicodeDecodeError
        with pytest.raises((UnauthorizedError, UnicodeDecodeError)):
            require_admin(credentials)


@pytest.mark.asyncio
async def test_trigger_data_ingestion_success():
    """測試成功觸發資料擷取"""
    from src.api.admin import trigger_data_ingestion, DataIngestionRequest

    mock_db = Mock()
    mock_service = Mock()
    mock_service.ingest_all = AsyncMock(return_value={"a1": 10, "a2": 20, "a3": 30})

    with patch("src.api.admin.DataIngestionService", return_value=mock_service):
        request = DataIngestionRequest(source_types=["A1", "A2"], force_refresh=True)
        result = await trigger_data_ingestion(request, mock_db)

    assert "job_id" in result
    assert result["result"] == {"a1": 10, "a2": 20, "a3": 30}
    assert "資料擷取工作已排程" in result["message"]

    # 驗證 service 被正確呼叫
    mock_service.ingest_all.assert_called_once_with(
        source_types=["A1", "A2"], force_refresh=True
    )


@pytest.mark.asyncio
async def test_trigger_data_ingestion_with_defaults():
    """測試使用預設參數觸發資料擷取"""
    from src.api.admin import trigger_data_ingestion

    mock_db = Mock()
    mock_service = Mock()
    mock_service.ingest_all = AsyncMock(return_value={})

    with patch("src.api.admin.DataIngestionService", return_value=mock_service):
        result = await trigger_data_ingestion(None, mock_db)

    assert "job_id" in result
    mock_service.ingest_all.assert_called_once_with(
        source_types=None, force_refresh=False
    )


@pytest.mark.asyncio
async def test_trigger_data_ingestion_failure():
    """測試資料擷取失敗"""
    from src.api.admin import trigger_data_ingestion, DataIngestionRequest

    mock_db = Mock()
    mock_service = Mock()
    mock_service.ingest_all = AsyncMock(side_effect=Exception("擷取失敗"))

    with patch("src.api.admin.DataIngestionService", return_value=mock_service):
        request = DataIngestionRequest()

        with pytest.raises(HTTPException) as exc_info:
            await trigger_data_ingestion(request, mock_db)

        assert exc_info.value.status_code == 500
        assert "資料擷取失敗" in exc_info.value.detail


@pytest.mark.asyncio
async def test_trigger_hotspot_analysis_success():
    """測試成功觸發熱點分析"""
    from src.api.admin import trigger_hotspot_analysis, HotspotAnalysisRequest

    mock_db = Mock()
    mock_service = Mock()
    mock_service.analyze = Mock(return_value=42)  # 回傳 42 個熱點

    with patch("src.api.admin.HotspotAnalysisService", return_value=mock_service):
        request = HotspotAnalysisRequest(
            analysis_period_days=180, epsilon_meters=300, min_samples=3
        )
        result = await trigger_hotspot_analysis(request, mock_db)

    assert "job_id" in result
    assert result["hotspot_count"] == 42
    assert "熱點分析工作已排程" in result["message"]

    # 驗證 service 被正確呼叫
    mock_service.analyze.assert_called_once_with(
        analysis_period_days=180, epsilon_meters=300, min_samples=3
    )


@pytest.mark.asyncio
async def test_trigger_hotspot_analysis_with_defaults():
    """測試使用預設參數觸發熱點分析"""
    from src.api.admin import trigger_hotspot_analysis

    mock_db = Mock()
    mock_service = Mock()
    mock_service.analyze = Mock(return_value=10)

    with patch("src.api.admin.HotspotAnalysisService", return_value=mock_service):
        result = await trigger_hotspot_analysis(None, mock_db)

    assert "job_id" in result
    assert result["hotspot_count"] == 10
    mock_service.analyze.assert_called_once_with(
        analysis_period_days=365, epsilon_meters=500, min_samples=5
    )


@pytest.mark.asyncio
async def test_trigger_hotspot_analysis_failure():
    """測試熱點分析失敗"""
    from src.api.admin import trigger_hotspot_analysis, HotspotAnalysisRequest

    mock_db = Mock()
    mock_service = Mock()
    mock_service.analyze = Mock(side_effect=Exception("分析失敗"))

    with patch("src.api.admin.HotspotAnalysisService", return_value=mock_service):
        request = HotspotAnalysisRequest()

        with pytest.raises(HTTPException) as exc_info:
            await trigger_hotspot_analysis(request, mock_db)

        assert exc_info.value.status_code == 500
        assert "熱點分析失敗" in exc_info.value.detail
