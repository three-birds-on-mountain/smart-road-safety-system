"""ETL：將 raw_moi_a3 匯入 accidents，並補上台北市經緯度資訊。"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Iterable, Optional

import httpx
import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json, RealDictCursor, execute_batch

ROC_YEAR_OFFSET = 1911
TAIWAN_TZ = timezone(timedelta(hours=8))
TAIPEI_KEYWORDS = ("台北市", "臺北市")
DEFAULT_BATCH_SIZE = 200
DEFAULT_GEOCODE_DELAY = 0.2

TIME_PATTERN = re.compile(
    r"(?P<year>\d{2,3})年(?P<month>\d{2})月(?P<day>\d{2})日\s+"
    r"(?P<hour>\d{2})時(?P<minute>\d{2})分(?P<second>\d{2})秒"
)
SLASH_SPLIT_RE = re.compile(r"\s*[\/／]\s*")
PAREN_PATTERN = re.compile(r"[（(].*?[)）]")
CHINESE_NUMERAL = "零〇一二三四五六七八九十百千甲乙丙丁"
ROAD_UNIT_PATTERN = r"(?:大道|路|街|巷|弄|道|線)"
DIRECTION_PATTERN = r"(?:東|西|南|北|東南|東北|西南|西北)"
ROAD_BASE_PATTERN = re.compile(
    rf"^(?P<base>.+?{ROAD_UNIT_PATTERN}"
    rf"(?:[{CHINESE_NUMERAL}\d]+段)?"
    rf"(?:[{CHINESE_NUMERAL}\d]+巷)?"
    rf"(?:[{CHINESE_NUMERAL}\d]+弄)?"
    r"(?:\d+號)?"
    r")"
)
DISTANCE_PATTERNS = [
    re.compile(r"\s+\d+(?:\.\d+)?公里.*$", re.IGNORECASE),
    re.compile(r"\s+\d+(?:\.\d+)?公尺.*$", re.IGNORECASE),
    re.compile(r"\s+K\d+(?:\+\d+)?\w?.*$", re.IGNORECASE),
]
POLE_PATTERNS = [
    re.compile(r"\s*(?:燈桿|電桿|電線桿)\d+.*$"),
]
TRUNCATION_REGEXES = [
    re.compile(
        rf"^(?P<prefix>.+?{ROAD_UNIT_PATTERN}(?:[{CHINESE_NUMERAL}\d]+段)?)\s*口.*$"
    ),
    re.compile(
        rf"^(?P<prefix>.+?{ROAD_UNIT_PATTERN}(?:[{CHINESE_NUMERAL}\d]+段)?)\s*(?:前|附近|旁|對面).*$"
    ),
    re.compile(
        rf"^(?P<prefix>.+?{ROAD_UNIT_PATTERN}(?:[{CHINESE_NUMERAL}\d]+段)?)"
        rf"{DIRECTION_PATTERN}側.*$"
    ),
    re.compile(r"^(?P<prefix>.+?\d+號)\s*(?:前|附近|旁|對面).*$"),
]


class GeocodingError(RuntimeError):
    """Raised when geocoding configuration is invalid."""


@dataclass(slots=True)
class GeocodeResult:
    latitude: float
    longitude: float
    confidence: float


class GoogleGeocoder:
    """簡易 Google Maps (REST) 地理編碼器，附帶快取與速率控管。"""

    def __init__(self, api_key: str, delay: float = DEFAULT_GEOCODE_DELAY):
        if not api_key:
            raise GeocodingError("缺少 Google Maps API key，無法進行地理編碼。")
        self.api_key = api_key
        self.delay = max(0.0, delay)
        self._cache: dict[str, GeocodeResult] = {}
        self._client = httpx.Client(timeout=10.0)
        self._last_called = 0.0

    def geocode(self, address: str) -> Optional[GeocodeResult]:
        addr = (address or "").strip()
        if not addr:
            return None
        cached = self._cache.get(addr)
        if cached:
            return cached

        elapsed = time.perf_counter() - self._last_called
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)

        params = {
            "address": addr,
            "key": self.api_key,
            "language": "zh-TW",
            "region": "tw",
        }
        try:
            response = self._client.get(
                "https://maps.googleapis.com/maps/api/geocode/json", params=params
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:  # pragma: no cover - runtime safeguard
            print(f"[WARN] 無法地理編碼 {addr}: {exc}", file=sys.stderr)
            return None

        payload = response.json()
        status = payload.get("status")
        results = payload.get("results") or []
        if status != "OK" or not results:
            print(f"[WARN] 地理編碼失敗 {addr}: status={status}", file=sys.stderr)
            return None

        first = results[0]
        geometry = first.get("geometry", {})
        location = geometry.get("location") or {}
        location_type = geometry.get("location_type", "APPROXIMATE")
        lat = float(location.get("lat"))
        lng = float(location.get("lng"))
        confidence_map = {
            "ROOFTOP": 1.0,
            "RANGE_INTERPOLATED": 0.8,
            "GEOMETRIC_CENTER": 0.6,
            "APPROXIMATE": 0.4,
        }
        confidence = confidence_map.get(location_type, 0.5)

        result = GeocodeResult(latitude=lat, longitude=lng, confidence=confidence)
        self._cache[addr] = result
        self._last_called = time.perf_counter()
        return result

    def close(self) -> None:
        self._client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="從 raw_moi_a3 轉寫 accidents（僅台北市資料）。"
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL 連線字串（預設讀 DATABASE_URL 環境變數）。",
    )
    parser.add_argument(
        "--raw-table",
        default="raw_moi_a3",
        help="來源資料表名稱（default: raw_moi_a3）。",
    )
    parser.add_argument(
        "--accident-table",
        default="accidents",
        help="目的 accidents 資料表名稱（default: accidents）。",
    )
    parser.add_argument(
        "--google-api-key",
        default=os.environ.get("GOOGLE_MAPS_API_KEY"),
        help="Google Maps Geocoding API key（default: GOOGLE_MAPS_API_KEY）。",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"批次寫入筆數（default: {DEFAULT_BATCH_SIZE}）。",
    )
    parser.add_argument(
        "--geocode-delay",
        type=float,
        default=DEFAULT_GEOCODE_DELAY,
        help="地理編碼請求間隔秒數（default: 0.2）。",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="僅處理指定筆數（除錯用）。",
    )
    return parser.parse_args()


def parse_occurrence_time(raw_value: str) -> Optional[datetime]:
    """將 114年01月01日 00時00分00秒 轉成 timezone-aware datetime。"""
    if not raw_value:
        return None
    raw_value = raw_value.strip()

    match = TIME_PATTERN.search(raw_value)
    if not match:
        # 嘗試 ISO 8601
        try:
            parsed = datetime.fromisoformat(raw_value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=TAIWAN_TZ)
            return parsed.astimezone(TAIWAN_TZ)
        except ValueError:
            return None

    roc_year = int(match.group("year"))
    year = roc_year + ROC_YEAR_OFFSET
    month = int(match.group("month"))
    day = int(match.group("day"))
    hour = int(match.group("hour"))
    minute = int(match.group("minute"))
    second = int(match.group("second"))
    return datetime(year, month, day, hour, minute, second, tzinfo=TAIWAN_TZ)


def ensure_decimal(value: float, places: str) -> Decimal:
    """協助格式化浮點數，避免二進位誤差。"""
    return Decimal(str(value)).quantize(Decimal(places))


def normalize_location_text(location: str) -> str:
    """簡化 A3 發生地點：只保留路/段/巷/線等核心位置。"""
    text = (location or "").strip()
    if not text:
        return ""

    text = text.replace("／", "/")
    parts = SLASH_SPLIT_RE.split(text, maxsplit=1)
    text = parts[0].strip()
    text = PAREN_PATTERN.sub("", text).strip()
    text = re.sub(r"[、，]+$", "", text)
    text = re.sub(r"\s+", " ", text)

    for pattern in DISTANCE_PATTERNS:
        text = pattern.sub("", text).strip()
    for pattern in POLE_PATTERNS:
        text = pattern.sub("", text).strip()

    for regex in TRUNCATION_REGEXES:
        match = regex.match(text)
        if match:
            text = match.group("prefix").strip()

    text = text.strip(" 、，")
    match = ROAD_BASE_PATTERN.match(text)
    if match:
        return match.group("base").strip()
    return text


def split_vehicle_types(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    parts = re.split(r"[;；]", raw_value)
    return [part.strip() for part in parts if part.strip()]


def aggregate_vehicle_rows(rows: Iterable[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], dict] = {}
    for row in rows:
        occurrence_raw = (row.get("occurrence_time") or "").strip()
        location_raw = (row.get("location") or "").strip()
        if not occurrence_raw or not location_raw:
            continue

        key = (occurrence_raw, location_raw)
        entry = grouped.get(key)
        if entry is None:
            entry = {
                "source_id": row.get("source_id"),
                "occurrence_time": occurrence_raw,
                "location": location_raw,
                "vehicle_types": [],
                "vehicle_types_set": set(),
                "source_ids": [],
            }
            grouped[key] = entry

        entry["source_ids"].append(row.get("source_id"))
        vehicle_parts = split_vehicle_types(row.get("vehicle_type"))
        for vehicle in vehicle_parts or [""]:
            if not vehicle:
                continue
            if vehicle not in entry["vehicle_types_set"]:
                entry["vehicle_types"].append(vehicle)
                entry["vehicle_types_set"].add(vehicle)
    aggregated: list[dict] = []
    for entry in grouped.values():
        vehicle_str = ";".join(entry["vehicle_types"]) if entry["vehicle_types"] else None
        aggregated.append(
            {
                "source_id": entry["source_id"],
                "occurrence_time": entry["occurrence_time"],
                "location": entry["location"],
                "vehicle_type": vehicle_str,
                "vehicle_types": entry["vehicle_types"],
                "source_ids": entry["source_ids"],
            }
        )
    return aggregated


def purge_existing(conn, target_table: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("DELETE FROM {} WHERE source_type = %s").format(
                sql.Identifier(target_table)
            ),
            ("A3",),
        )
        deleted = cur.rowcount or 0
    print(f"[INFO] 已刪除 accidents 中 {deleted} 筆 A3 紀錄。")
    return deleted


def fetch_raw_rows(
    conn, source_table: str, limit: Optional[int] = None
) -> list[dict]:
    query = sql.SQL(
        """
        SELECT source_id, occurrence_time, location, vehicle_type
        FROM {table}
        WHERE occurrence_time IS NOT NULL
          AND location IS NOT NULL
          AND (
              {like_1} OR {like_2}
          )
        ORDER BY source_id
        """
    ).format(
        table=sql.Identifier(source_table),
        like_1=sql.SQL("location LIKE %s"),
        like_2=sql.SQL("location LIKE %s"),
    )
    params: list = [f"%{TAIPEI_KEYWORDS[0]}%", f"%{TAIPEI_KEYWORDS[1]}%"]
    if limit:
        query += sql.SQL(" LIMIT %s")
        params.append(limit)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
    print(f"[INFO] 找到 {len(rows)} 筆台北市 A3 原始資料。")
    return rows


def build_insert_sql(target_table: str) -> sql.SQL:
    return sql.SQL(
        """
        INSERT INTO {table} (
            source_type,
            source_id,
            occurred_at,
            location_text,
            latitude,
            longitude,
            geom,
            severity_level,
            vehicle_type,
            raw_data,
            geocoded,
            geocode_confidence
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
            %s, %s, %s, %s
        )
        ON CONFLICT (source_type, source_id) DO UPDATE SET
            occurred_at = EXCLUDED.occurred_at,
            location_text = EXCLUDED.location_text,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            geom = EXCLUDED.geom,
            vehicle_type = EXCLUDED.vehicle_type,
            raw_data = EXCLUDED.raw_data,
            geocoded = EXCLUDED.geocoded,
            geocode_confidence = EXCLUDED.geocode_confidence,
            updated_at = NOW();
        """
    ).format(table=sql.Identifier(target_table))


def translate_rows(
    rows: Iterable[dict],
    geocoder: GoogleGeocoder,
) -> list[tuple]:
    translated: list[tuple] = []

    for idx, row in enumerate(rows, 1):
        source_id = (row.get("source_id") or "").strip()
        raw_location = (row.get("location") or "").strip()
        occurrence_raw = row.get("occurrence_time")
        vehicle_type = (row.get("vehicle_type") or "").strip() or None
        vehicle_types = row.get("vehicle_types") or []
        source_ids = row.get("source_ids") or [source_id]

        if not source_id or not raw_location:
            print(f"[WARN] 第 {idx} 筆缺少 source_id/location，略過。", file=sys.stderr)
            continue

        normalized_location = normalize_location_text(raw_location)
        if not normalized_location:
            normalized_location = raw_location.strip()

        occurred_at = parse_occurrence_time(occurrence_raw)
        if not occurred_at:
            print(
                f"[WARN] 第 {idx} 筆無法解析發生時間：{occurrence_raw}, 略過。",
                file=sys.stderr,
            )
            continue

        geo = geocoder.geocode(normalized_location)
        if not geo:
            print(
                f"[WARN] 第 {idx} 筆地理編碼失敗：{normalized_location}，略過。",
                file=sys.stderr,
            )
            continue

        lat = ensure_decimal(geo.latitude, "0.0000001")
        lng = ensure_decimal(geo.longitude, "0.0000001")
        confidence = ensure_decimal(geo.confidence, "0.01")

        raw_payload = {
            "occurrence_time": occurrence_raw,
            "location_raw": raw_location,
            "location_normalized": normalized_location,
            "vehicle_type": vehicle_type,
            "vehicle_types": vehicle_types,
            "source_ids": source_ids,
        }

        translated.append(
            (
                "A3",
                source_id,
                occurred_at,
                normalized_location,
                lat,
                lng,
                lng,  # for ST_MakePoint
                lat,  # for ST_MakePoint
                "A3",
                Json(raw_payload, dumps=lambda obj: json.dumps(obj, ensure_ascii=False)),
                True,
                confidence,
            )
        )
    return translated


def insert_accidents(conn, insert_sql: sql.SQL, rows: list[tuple], batch_size: int) -> int:
    if not rows:
        return 0
    with conn.cursor() as cur:
        execute_batch(cur, insert_sql.as_string(conn), rows, page_size=batch_size)
    return len(rows)


def main() -> None:
    args = parse_args()
    if not args.database_url:
        raise SystemExit("請提供 --database-url 或設定 DATABASE_URL 環境變數。")
    try:
        geocoder = GoogleGeocoder(
            api_key=args.google_api_key or "",
            delay=args.geocode_delay,
        )
    except GeocodingError as exc:
        raise SystemExit(str(exc)) from exc

    inserted = 0
    try:
        with psycopg2.connect(args.database_url) as conn:
            conn.autocommit = False
            purge_existing(conn, args.accident_table)
            raw_rows = fetch_raw_rows(conn, args.raw_table, args.limit)
            grouped_rows = aggregate_vehicle_rows(raw_rows)
            payloads = translate_rows(grouped_rows, geocoder)
            insert_sql = build_insert_sql(args.accident_table)
            inserted = insert_accidents(conn, insert_sql, payloads, args.batch_size)
            conn.commit()
    finally:
        geocoder.close()
    print(f"[INFO] 已成功寫入 {inserted} 筆 A3 台北市事故資料。")


if __name__ == "__main__":
    main()
