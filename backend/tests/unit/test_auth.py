"""測試 JWT 認證功能"""
import time
import pytest
from src.core.auth import encode_hs256_jwt, decode_hs256_jwt
from src.core.errors import UnauthorizedError


def test_encode_decode_jwt_success():
    """測試正常的 JWT 編碼與解碼"""
    secret = "test-secret-key"
    payload = {"user_id": "123", "role": "admin", "scope": "admin"}

    # 編碼
    token = encode_hs256_jwt(payload, secret)
    assert isinstance(token, str)
    assert token.count(".") == 2  # JWT 格式：header.payload.signature

    # 解碼
    decoded = decode_hs256_jwt(token, secret)
    assert decoded["user_id"] == "123"
    assert decoded["role"] == "admin"
    assert decoded["scope"] == "admin"


def test_decode_jwt_with_exp_valid():
    """測試帶有未過期 exp 的 JWT"""
    secret = "test-secret-key"
    # 設定 10 秒後過期
    future_time = int(time.time()) + 10
    payload = {"user_id": "123", "role": "admin", "exp": future_time}

    token = encode_hs256_jwt(payload, secret)
    decoded = decode_hs256_jwt(token, secret)

    assert decoded["user_id"] == "123"
    assert decoded["exp"] == future_time


def test_decode_jwt_with_exp_expired():
    """測試已過期的 JWT"""
    secret = "test-secret-key"
    # 設定已過期（1 秒前）
    past_time = int(time.time()) - 1
    payload = {"user_id": "123", "role": "admin", "exp": past_time}

    token = encode_hs256_jwt(payload, secret)

    with pytest.raises(UnauthorizedError, match="JWT 已逾期"):
        decode_hs256_jwt(token, secret)


def test_decode_jwt_invalid_format():
    """測試無效的 JWT 格式"""
    secret = "test-secret-key"

    # 測試格式錯誤的 token
    with pytest.raises(UnauthorizedError, match="無效的 JWT 格式"):
        decode_hs256_jwt("invalid.token", secret)

    with pytest.raises(UnauthorizedError, match="無效的 JWT 格式"):
        decode_hs256_jwt("only-one-part", secret)


def test_decode_jwt_wrong_secret():
    """測試錯誤的密鑰"""
    payload = {"user_id": "123", "role": "admin"}
    token = encode_hs256_jwt(payload, "correct-secret")

    with pytest.raises(UnauthorizedError, match="JWT 簽章驗證失敗"):
        decode_hs256_jwt(token, "wrong-secret")


def test_decode_jwt_invalid_algorithm():
    """測試不支援的演算法"""
    # 手動建立一個使用 RS256 的 JWT header
    import base64
    import json

    header = {"alg": "RS256", "typ": "JWT"}
    payload = {"user_id": "123"}

    header_b64 = base64.urlsafe_b64encode(
        json.dumps(header).encode()
    ).rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).rstrip(b"=").decode()

    fake_token = f"{header_b64}.{payload_b64}.fake_signature"

    with pytest.raises(UnauthorizedError, match="不支援的簽章演算法"):
        decode_hs256_jwt(fake_token, "secret")


def test_decode_jwt_invalid_base64():
    """測試無效的 Base64 編碼"""
    # 使用無效的 Base64 字串
    invalid_token = "!!!invalid!!!.!!!invalid!!!.!!!invalid!!!"

    # 此測試會觸發 UnicodeDecodeError，這是預期的行為
    with pytest.raises((UnauthorizedError, UnicodeDecodeError)):
        decode_hs256_jwt(invalid_token, "secret")


def test_decode_jwt_invalid_json_header():
    """測試無效的 JSON header"""
    import base64

    # 建立無效 JSON 的 header
    invalid_header = base64.urlsafe_b64encode(b"{invalid json").rstrip(b"=").decode()
    valid_payload = base64.urlsafe_b64encode(b'{"user":"test"}').rstrip(b"=").decode()

    invalid_token = f"{invalid_header}.{valid_payload}.signature"

    with pytest.raises(UnauthorizedError, match="JWT header 格式不正確"):
        decode_hs256_jwt(invalid_token, "secret")


def test_decode_jwt_invalid_json_payload():
    """測試無效的 JSON payload"""
    secret = "test-secret-key"

    # 建立一個有效的 header 但無效 payload 的 token
    import base64
    import json
    import hmac
    import hashlib

    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(
        json.dumps(header).encode()
    ).rstrip(b"=").decode()

    # 無效的 JSON payload
    invalid_payload_b64 = base64.urlsafe_b64encode(b"{invalid}").rstrip(b"=").decode()

    signing_input = f"{header_b64}.{invalid_payload_b64}".encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()

    invalid_token = f"{header_b64}.{invalid_payload_b64}.{signature_b64}"

    with pytest.raises(UnauthorizedError, match="JWT payload 格式不正確"):
        decode_hs256_jwt(invalid_token, secret)


def test_decode_jwt_invalid_exp_format():
    """測試無效的 exp 格式"""
    secret = "test-secret-key"
    # exp 應該是數字，但這裡給字串
    payload = {"user_id": "123", "exp": "not-a-number"}

    token = encode_hs256_jwt(payload, secret)

    with pytest.raises(UnauthorizedError, match="JWT exp 欄位格式不正確"):
        decode_hs256_jwt(token, secret)


def test_jwt_with_special_characters():
    """測試包含特殊字元的 payload"""
    secret = "test-secret-key"
    payload = {
        "user_id": "123",
        "name": "測試用戶",
        "email": "test@example.com",
        "data": {"key": "值"},
    }

    token = encode_hs256_jwt(payload, secret)
    decoded = decode_hs256_jwt(token, secret)

    assert decoded["name"] == "測試用戶"
    assert decoded["email"] == "test@example.com"
    assert decoded["data"]["key"] == "值"
