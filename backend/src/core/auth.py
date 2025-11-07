"""JWT 工具：提供簡易的 HS256 驗證"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict

from src.core.errors import UnauthorizedError


def _b64url_encode(value: bytes) -> str:
    """Base64url 編碼（移除填充）"""
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _b64url_decode(value: str) -> bytes:
    """Base64url 解碼（補齊填充字元）"""
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode(value + padding)
    except (ValueError, base64.binascii.Error) as exc:
        raise UnauthorizedError("JWT 內容不是合法的 Base64Url 格式") from exc


def decode_hs256_jwt(token: str, secret: str) -> Dict[str, Any]:
    """驗證並解析 HS256 JWT"""
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise UnauthorizedError("無效的 JWT 格式") from exc

    header_bytes = _b64url_decode(header_b64)
    try:
        header = json.loads(header_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise UnauthorizedError("JWT header 格式不正確") from exc

    if header.get("alg") != "HS256":
        raise UnauthorizedError("不支援的簽章演算法，僅支援 HS256")

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = _b64url_decode(signature_b64)
    expected_signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()

    if not hmac.compare_digest(signature, expected_signature):
        raise UnauthorizedError("JWT 簽章驗證失敗")

    payload_bytes = _b64url_decode(payload_b64)
    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise UnauthorizedError("JWT payload 格式不正確") from exc

    exp = payload.get("exp")
    if exp is not None:
        if not isinstance(exp, (int, float)):
            raise UnauthorizedError("JWT exp 欄位格式不正確")
        current_timestamp = time.time()
        if exp < current_timestamp:
            raise UnauthorizedError("JWT 已逾期，請重新登入")

    return payload


def encode_hs256_jwt(payload: Dict[str, Any], secret: str) -> str:
    """使用 HS256 建立 JWT（測試與工具用途）"""
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


__all__ = ["decode_hs256_jwt", "encode_hs256_jwt"]
