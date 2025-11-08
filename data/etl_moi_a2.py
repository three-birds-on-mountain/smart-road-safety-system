"""ETL：將 raw_moi_a2 台北市資料整併寫入 accidents。"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Iterable, Optional

import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json, RealDictCursor, execute_batch

TAIWAN_TZ = timezone(timedelta(hours=8))
TAIPEI_KEYWORDS = ("台北市", "臺北市")
DEFAULT_BATCH_SIZE = 500
VEHICLE_COLUMN = "accident_type_major_name"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="將 raw_moi_a2 的台北市事故資料整併到 accidents。"
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL 連線字串（預設讀 DATABASE_URL）。",
    )
    parser.add_argument(
        "--raw-table",
        default="raw_moi_a2",
        help="來源資料表名稱（default: raw_moi_a2）。",
    )
    parser.add_argument(
        "--accident-table",
        default="accidents",
        help="目標 accidents 表名稱（default: accidents）。",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"批次寫入筆數（default: {DEFAULT_BATCH_SIZE}）。",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="僅處理指定筆數原始資料（除錯用）。",
    )
    return parser.parse_args()


def parse_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def parse_occurrence_datetime(
    year: Optional[str],
    month: Optional[str],
    date_value: Optional[str],
    time_value: Optional[str],
) -> Optional[datetime]:
    year_int: Optional[int] = None
    month_int: Optional[int] = None
    day_int: Optional[int] = None

    if date_value:
        digits = "".join(ch for ch in date_value if ch.isdigit())
        if len(digits) >= 8:
            year_int = int(digits[:4])
            month_int = int(digits[4:6])
            day_int = int(digits[6:8])

    if year_int is None:
        year_int = parse_int(year)
    if month_int is None:
        month_int = parse_int(month)
    if day_int is None and date_value:
        digits = "".join(ch for ch in date_value if ch.isdigit())
        if len(digits) >= 8:
            day_int = int(digits[6:8])

    time_digits = (time_value or "").strip()
    if not time_digits:
        return None
    time_digits = "".join(ch for ch in time_digits if ch.isdigit())
    if not time_digits:
        return None
    if len(time_digits) < 6:
        time_digits = time_digits.zfill(6)
    hour = int(time_digits[0:2])
    minute = int(time_digits[2:4])
    second = int(time_digits[4:6])

    if not all(val is not None for val in (year_int, month_int, day_int)):
        return None

    try:
        return datetime(
            year_int, month_int, day_int, hour, minute, second, tzinfo=TAIWAN_TZ
        )
    except ValueError:
        return None


def ensure_decimal(value: float, fmt: str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal(fmt))


def to_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_raw_rows(
    conn, source_table: str, limit: Optional[int] = None
) -> list[dict]:
    query = sql.SQL(
        """
        SELECT
            source_id,
            occurrence_year,
            occurrence_month,
            occurrence_date,
            occurrence_time,
            location,
            longitude,
            latitude,
            {vehicle_column}
        FROM {table}
        WHERE location IS NOT NULL
          AND location <> ''
          AND longitude IS NOT NULL
          AND longitude <> ''
          AND latitude IS NOT NULL
          AND latitude <> ''
          AND (
                location LIKE %s
             OR location LIKE %s
          )
        ORDER BY source_id
        """
    ).format(
        table=sql.Identifier(source_table),
        vehicle_column=sql.Identifier(VEHICLE_COLUMN),
    )
    params = [f"%{TAIPEI_KEYWORDS[0]}%", f"%{TAIPEI_KEYWORDS[1]}%"]
    if limit:
        query += sql.SQL(" LIMIT %s")
        params.append(limit)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
    print(f"[INFO] 從 {source_table} 取得 {len(rows)} 筆台北市 A2 原始資料。")
    return rows


def aggregate_rows(rows: Iterable[dict]) -> list[dict]:
    grouped: dict[tuple[str, str, str, str, str], dict] = {}
    for row in rows:
        occ_year = (row.get("occurrence_year") or "").strip()
        occ_month = (row.get("occurrence_month") or "").strip()
        occ_date = (row.get("occurrence_date") or "").strip()
        occ_time = (row.get("occurrence_time") or "").strip()
        location = (row.get("location") or "").strip()
        if not occ_time or not location:
            continue
        key = (occ_year, occ_month, occ_date, occ_time, location)
        entry = grouped.get(key)
        if entry is None:
            entry = {
                "source_id": row.get("source_id"),
                "occurrence_year": occ_year,
                "occurrence_month": occ_month,
                "occurrence_date": occ_date,
                "occurrence_time": occ_time,
                "location": location,
                "longitude": row.get("longitude"),
                "latitude": row.get("latitude"),
                "vehicle_types": [],
                "vehicle_types_set": set(),
                "source_ids": [],
            }
            grouped[key] = entry

        entry["source_ids"].append(row.get("source_id"))
        vehicle_value = (row.get(VEHICLE_COLUMN) or "").strip()
        if vehicle_value and vehicle_value not in entry["vehicle_types_set"]:
            entry["vehicle_types"].append(vehicle_value)
            entry["vehicle_types_set"].add(vehicle_value)

    aggregated = []
    for entry in grouped.values():
        aggregated.append(
            {
                **{k: entry[k] for k in (
                    "source_id",
                    "occurrence_year",
                    "occurrence_month",
                    "occurrence_date",
                    "occurrence_time",
                    "location",
                    "longitude",
                    "latitude",
                )},
                "vehicle_types": entry["vehicle_types"],
                "source_ids": entry["source_ids"],
            }
        )
    print(f"[INFO] 聚合後剩 {len(aggregated)} 筆事故（依時間+地點）。")
    return aggregated


def purge_existing(conn, target_table: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("DELETE FROM {} WHERE source_type = %s").format(
                sql.Identifier(target_table)
            ),
            ("A2",),
        )
        deleted = cur.rowcount or 0
    print(f"[INFO] 已清除 accidents 內 {deleted} 筆 A2 舊資料。")
    return deleted


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


def prepare_payloads(rows: Iterable[dict]) -> list[tuple]:
    prepared: list[tuple] = []
    for idx, row in enumerate(rows, 1):
        occurred_at = parse_occurrence_datetime(
            row.get("occurrence_year"),
            row.get("occurrence_month"),
            row.get("occurrence_date"),
            row.get("occurrence_time"),
        )
        if occurred_at is None:
            print(f"[WARN] 第 {idx} 筆無法解析發生時間，略過。")
            continue

        lon = to_float(row.get("longitude"))
        lat = to_float(row.get("latitude"))
        if lon is None or lat is None:
            print(f"[WARN] 第 {idx} 筆缺少經緯度，略過。")
            continue

        vehicle_types = row.get("vehicle_types") or []
        vehicle_type_str = ";".join(vehicle_types) if vehicle_types else None

        raw_payload = {
            "source_ids": row.get("source_ids"),
            "vehicle_types": vehicle_types,
            "location": row.get("location"),
            "timestamp_fields": {
                "occurrence_year": row.get("occurrence_year"),
                "occurrence_month": row.get("occurrence_month"),
                "occurrence_date": row.get("occurrence_date"),
                "occurrence_time": row.get("occurrence_time"),
            },
        }

        lat_decimal = ensure_decimal(lat, "0.0000001")
        lon_decimal = ensure_decimal(lon, "0.0000001")

        prepared.append(
            (
                "A2",
                row.get("source_id"),
                occurred_at,
                row.get("location"),
                lat_decimal,
                lon_decimal,
                lon_decimal,
                lat_decimal,
                "A2",
                vehicle_type_str,
                Json(raw_payload, dumps=lambda obj: json.dumps(obj, ensure_ascii=False)),
                False,
                None,
            )
        )
    return prepared


def insert_rows(conn, insert_sql: sql.SQL, payloads: list[tuple], batch_size: int) -> int:
    if not payloads:
        return 0
    with conn.cursor() as cur:
        execute_batch(cur, insert_sql.as_string(conn), payloads, page_size=batch_size)
    return len(payloads)


def main() -> None:
    args = parse_args()
    if not args.database_url:
        raise SystemExit("請提供 --database-url 或設定 DATABASE_URL 環境變數。")

    with psycopg2.connect(args.database_url) as conn:
        conn.autocommit = False
        purge_existing(conn, args.accident_table)
        raw_rows = fetch_raw_rows(conn, args.raw_table, args.limit)
        grouped_rows = aggregate_rows(raw_rows)
        payloads = prepare_payloads(grouped_rows)
        insert_sql = build_insert_sql(args.accident_table)
        inserted = insert_rows(conn, insert_sql, payloads, args.batch_size)
        conn.commit()

    print(f"[INFO] 已寫入 {inserted} 筆台北市 A2 事故資料。")


if __name__ == "__main__":
    main()
