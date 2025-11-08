#!/usr/bin/env python3
"""
ETL Script: 從 accidents table 生成 hotspots table

此腳本會：
1. 從 accidents table 讀取指定時間範圍的事故資料
2. 使用 DBSCAN 聚類演算法識別事故熱點
3. 計算每個熱點的統計資訊（中心點、半徑、事故數等）
4. 將結果寫入 hotspots table

使用範例：
  uv run python data/generate_hotspots.py --database-url "$DATABASE_URL"
  uv run python data/generate_hotspots.py --period-days 365 --min-accidents 5
"""

import argparse
import sys
from datetime import datetime, timedelta, date, timezone
from decimal import Decimal
from typing import List, Dict, Tuple
import uuid
import json

try:
    import psycopg2
    from psycopg2.extras import execute_values, RealDictCursor
except ImportError:
    print("❌ 請先安裝 psycopg2: uv add psycopg2-binary", file=sys.stderr)
    sys.exit(1)

try:
    import numpy as np
    from sklearn.cluster import DBSCAN
except ImportError:
    print("❌ 請先安裝 scikit-learn: uv add scikit-learn", file=sys.stderr)
    sys.exit(1)

try:
    from geopy.distance import geodesic
except ImportError:
    print("❌ 請先安裝 geopy: uv add geopy", file=sys.stderr)
    sys.exit(1)


def parse_args():
    """解析命令列參數"""
    parser = argparse.ArgumentParser(
        description="從 accidents table 生成 hotspots table (DBSCAN 聚類分析)"
    )

    parser.add_argument(
        "--database-url",
        type=str,
        required=True,
        help="PostgreSQL 連線字串 (例如: postgresql://user:pass@host:5432/dbname)",
    )

    parser.add_argument(
        "--period-days",
        type=int,
        default=365,
        help="分析過去幾天的事故資料 (預設: 365)",
    )

    parser.add_argument(
        "--epsilon-meters",
        type=int,
        default=500,
        help="DBSCAN epsilon 參數：聚類半徑（公尺）(預設: 500)",
    )

    parser.add_argument(
        "--min-accidents",
        type=int,
        default=5,
        help="DBSCAN min_samples 參數：最小事故數 (預設: 5)",
    )

    parser.add_argument(
        "--clear-existing",
        action="store_true",
        help="清除現有的 hotspots 資料",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="測試模式：不寫入資料庫",
    )

    return parser.parse_args()


def fetch_accidents(conn, cutoff_date: datetime) -> List[Dict]:
    """
    從 accidents table 讀取指定時間範圍的事故資料

    Args:
        conn: 資料庫連線
        cutoff_date: 最早事故時間（之前的不納入分析）

    Returns:
        事故記錄列表
    """
    print(f"📊 讀取 {cutoff_date.date()} 之後的事故資料...")

    query = """
        SELECT 
            id::text,
            source_type,
            occurred_at,
            latitude,
            longitude
        FROM accidents
        WHERE occurred_at >= %s
        ORDER BY occurred_at DESC
    """

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, (cutoff_date,))
        accidents = cur.fetchall()

    print(f"✅ 讀取 {len(accidents)} 筆事故記錄")
    return accidents


def perform_dbscan_clustering(
    accidents: List[Dict], epsilon_meters: int, min_samples: int
) -> Tuple[np.ndarray, np.ndarray]:
    """
    使用 DBSCAN 演算法進行聚類分析

    Args:
        accidents: 事故記錄列表
        epsilon_meters: 聚類半徑（公尺）
        min_samples: 最小事故數

    Returns:
        (coordinates, labels) - 座標陣列和聚類標籤
    """
    print(f"\n🔬 執行 DBSCAN 聚類分析...")
    print(f"   參數: epsilon={epsilon_meters}m, min_samples={min_samples}")

    # 準備座標資料
    coordinates = np.array(
        [[float(acc["latitude"]), float(acc["longitude"])] for acc in accidents]
    )

    # 執行 DBSCAN（使用 haversine 距離計算地球表面距離）
    epsilon_degrees = epsilon_meters / 111000.0  # 約略：1度 ≈ 111公里

    dbscan = DBSCAN(
        eps=epsilon_degrees,
        min_samples=min_samples,
        metric="haversine",
        algorithm="ball_tree",
    )

    labels = dbscan.fit_predict(np.radians(coordinates))

    # 統計結果
    unique_labels = set(labels)
    noise_points = list(labels).count(-1)
    cluster_count = len(unique_labels) - (1 if -1 in unique_labels else 0)

    print(f"✅ 聚類完成：")
    print(f"   - 發現 {cluster_count} 個熱點")
    print(f"   - 噪音點（未歸類事故）: {noise_points} 筆")

    return coordinates, labels


def calculate_hotspot_center(
    coordinates: List[Tuple[float, float]],
) -> Tuple[float, float]:
    """計算熱點中心點（使用平均值）"""
    lats = [coord[0] for coord in coordinates]
    lngs = [coord[1] for coord in coordinates]
    return (sum(lats) / len(lats), sum(lngs) / len(lngs))


def calculate_hotspot_radius(
    coordinates: List[Tuple[float, float]], center: Tuple[float, float]
) -> int:
    """計算熱點影響半徑（公尺）"""
    if not coordinates:
        return 100  # 預設半徑

    # 計算所有點到中心的距離，取最大值
    max_distance = 0
    for coord in coordinates:
        distance = geodesic(center, coord).meters
        max_distance = max(max_distance, distance)

    # 加上緩衝區（20%）
    radius = int(max_distance * 1.2)
    # 限制在半徑範圍內（50-2000公尺）
    return max(50, min(2000, radius))


def generate_hotspot_records(
    accidents: List[Dict],
    coordinates: np.ndarray,
    labels: np.ndarray,
    min_samples: int,
    analysis_period_start: date,
    analysis_period_end: date,
) -> List[Dict]:
    """
    根據聚類結果生成熱點記錄

    Args:
        accidents: 事故記錄列表
        coordinates: 座標陣列
        labels: 聚類標籤
        min_samples: 最小事故數（過濾用）
        analysis_period_start: 分析期間起始日期
        analysis_period_end: 分析期間結束日期

    Returns:
        熱點記錄列表
    """
    print(f"\n📈 生成熱點記錄...")

    hotspots = []
    unique_labels = set(labels)
    if -1 in unique_labels:
        unique_labels.remove(-1)  # 移除噪音點標籤

    analysis_date = date.today()

    for label in unique_labels:
        # 取得此聚類的所有事故
        cluster_mask = labels == label
        cluster_indices = np.where(cluster_mask)[0]
        cluster_accidents = [accidents[i] for i in cluster_indices]

        if len(cluster_accidents) < min_samples:
            continue

        # 計算中心點和半徑
        cluster_coords = [
            (float(acc["latitude"]), float(acc["longitude"]))
            for acc in cluster_accidents
        ]
        center_lat, center_lng = calculate_hotspot_center(cluster_coords)
        radius = calculate_hotspot_radius(cluster_coords, (center_lat, center_lng))

        # 統計事故數量（按 source_type 分類）
        a1_count = sum(1 for acc in cluster_accidents if acc["source_type"] == "A1")
        a2_count = sum(1 for acc in cluster_accidents if acc["source_type"] == "A2")
        a3_count = sum(1 for acc in cluster_accidents if acc["source_type"] == "A3")

        # 時間範圍
        occurred_times = [acc["occurred_at"] for acc in cluster_accidents]
        earliest = min(occurred_times)
        latest = max(occurred_times)

        # 事故 ID 列表
        accident_ids = [acc["id"] for acc in cluster_accidents]

        hotspot = {
            "id": str(uuid.uuid4()),
            "center_latitude": Decimal(str(center_lat)).quantize(Decimal("0.0000001")),
            "center_longitude": Decimal(str(center_lng)).quantize(Decimal("0.0000001")),
            "radius_meters": radius,
            "total_accidents": len(cluster_accidents),
            "a1_count": a1_count,
            "a2_count": a2_count,
            "a3_count": a3_count,
            "earliest_accident_at": earliest,
            "latest_accident_at": latest,
            "analysis_date": analysis_date,
            "analysis_period_start": analysis_period_start,
            "analysis_period_end": analysis_period_end,
            "accident_ids": json.dumps(accident_ids),
        }

        hotspots.append(hotspot)

    print(f"✅ 生成 {len(hotspots)} 筆熱點記錄")
    return hotspots


def insert_hotspots(conn, hotspots: List[Dict], clear_existing: bool):
    """
    將熱點記錄寫入 hotspots table

    Args:
        conn: 資料庫連線
        hotspots: 熱點記錄列表
        clear_existing: 是否清除現有資料
    """
    print(f"\n💾 寫入熱點資料到 hotspots table...")

    with conn.cursor() as cur:
        if clear_existing:
            print("   清除現有熱點資料...")
            cur.execute("DELETE FROM hotspots;")
            deleted = cur.rowcount
            print(f"   已刪除 {deleted} 筆舊資料")

        # 準備插入資料
        insert_query = """
            INSERT INTO hotspots (
                id,
                center_latitude,
                center_longitude,
                geom,
                radius_meters,
                total_accidents,
                a1_count,
                a2_count,
                a3_count,
                earliest_accident_at,
                latest_accident_at,
                analysis_date,
                analysis_period_start,
                analysis_period_end,
                accident_ids,
                created_at,
                updated_at
            ) VALUES %s
        """

        # 準備資料（geom 欄位會由 trigger 自動生成，這裡傳 NULL）
        now = datetime.now(timezone.utc)
        values = [
            (
                h["id"],
                h["center_latitude"],
                h["center_longitude"],
                None,  # geom 由 trigger 自動生成
                h["radius_meters"],
                h["total_accidents"],
                h["a1_count"],
                h["a2_count"],
                h["a3_count"],
                h["earliest_accident_at"],
                h["latest_accident_at"],
                h["analysis_date"],
                h["analysis_period_start"],
                h["analysis_period_end"],
                h["accident_ids"],
                now,
                now,
            )
            for h in hotspots
        ]

        execute_values(cur, insert_query, values)
        conn.commit()

        print(f"✅ 成功寫入 {len(hotspots)} 筆熱點記錄")


def print_summary(hotspots: List[Dict]):
    """印出分析摘要"""
    if not hotspots:
        print("\n📊 分析摘要：無熱點生成")
        return

    print(f"\n📊 分析摘要：")
    print(f"   總熱點數: {len(hotspots)}")

    total_accidents = sum(h["total_accidents"] for h in hotspots)
    total_a1 = sum(h["a1_count"] for h in hotspots)
    total_a2 = sum(h["a2_count"] for h in hotspots)
    total_a3 = sum(h["a3_count"] for h in hotspots)

    print(f"   涵蓋事故總數: {total_accidents}")
    print(f"   - A1 (死亡): {total_a1} 筆")
    print(f"   - A2 (受傷): {total_a2} 筆")
    print(f"   - A3 (財損): {total_a3} 筆")

    # 找出最危險的熱點
    most_dangerous = max(hotspots, key=lambda h: h["total_accidents"])
    print(f"\n   最危險熱點:")
    print(
        f"   - 位置: ({most_dangerous['center_latitude']}, {most_dangerous['center_longitude']})"
    )
    print(f"   - 事故數: {most_dangerous['total_accidents']} 筆")
    print(f"   - 半徑: {most_dangerous['radius_meters']} 公尺")


def main():
    """主函數"""
    args = parse_args()

    print("=" * 60)
    print("🚦 事故熱點 ETL 腳本")
    print("=" * 60)
    print(f"分析期間: 過去 {args.period_days} 天")
    print(
        f"DBSCAN 參數: epsilon={args.epsilon_meters}m, min_samples={args.min_accidents}"
    )
    print(f"測試模式: {'是' if args.dry_run else '否'}")
    print("=" * 60)

    # 連接資料庫
    try:
        conn = psycopg2.connect(args.database_url)
        print("✅ 資料庫連線成功\n")
    except Exception as e:
        print(f"❌ 資料庫連線失敗: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        # 1. 讀取事故資料
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=args.period_days)
        accidents = fetch_accidents(conn, cutoff_date)

        if len(accidents) < args.min_accidents:
            print(
                f"⚠️  事故數量不足 ({len(accidents)} < {args.min_accidents})，無法進行分析"
            )
            return

        # 2. 執行聚類分析
        coordinates, labels = perform_dbscan_clustering(
            accidents, args.epsilon_meters, args.min_accidents
        )

        # 3. 生成熱點記錄
        analysis_period_start = cutoff_date.date()
        analysis_period_end = date.today() - timedelta(days=1)

        hotspots = generate_hotspot_records(
            accidents,
            coordinates,
            labels,
            args.min_accidents,
            analysis_period_start,
            analysis_period_end,
        )

        # 4. 寫入資料庫
        if not args.dry_run:
            insert_hotspots(conn, hotspots, args.clear_existing)
        else:
            print("\n⚠️  測試模式：不寫入資料庫")

        # 5. 印出摘要
        print_summary(hotspots)

        print("\n" + "=" * 60)
        print("✨ ETL 完成！")
        print("=" * 60)

    except Exception as e:
        conn.rollback()
        print(f"\n❌ 錯誤: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
