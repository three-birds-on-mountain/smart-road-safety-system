"""簡單的 seed 資料腳本（非互動式）"""
import asyncio
from datetime import datetime, timedelta, date
from decimal import Decimal
import random
import uuid
import json
import sys

from sqlalchemy.orm import Session
from sqlalchemy import text

from src.db.session import SessionLocal, engine
from src.models.accident import Accident
from src.models.hotspot import Hotspot
from src.models import SourceType
from src.db.session import Base
from geoalchemy2 import WKTElement

# 確保資料表存在
Base.metadata.create_all(bind=engine)


def generate_accident_data(count: int = 100) -> list[dict]:
    """產生假的事故資料"""
    accidents = []
    
    # 台灣主要城市座標範圍
    city_ranges = [
        {"lat": (24.95, 25.15), "lng": (121.40, 121.70), "name": "台北"},
        {"lat": (24.90, 25.05), "lng": (121.30, 121.60), "name": "新北"},
        {"lat": (24.80, 25.10), "lng": (121.00, 121.50), "name": "桃園"},
        {"lat": (24.10, 24.30), "lng": (120.50, 120.80), "name": "台中"},
        {"lat": (22.50, 22.80), "lng": (120.20, 120.50), "name": "高雄"},
    ]
    
    source_type_distribution = [
        (SourceType.A1, 0.05),
        (SourceType.A2, 0.35),
        (SourceType.A3, 0.60),
    ]
    
    for i in range(count):
        city = random.choice(city_ranges)
        lat = round(random.uniform(*city["lat"]), 7)
        lng = round(random.uniform(*city["lng"]), 7)
        
        rand = random.random()
        cumulative = 0
        source_type = SourceType.A3
        for src, prob in source_type_distribution:
            cumulative += prob
            if rand <= cumulative:
                source_type = src
                break
        days_ago = random.randint(0, 365)
        occurred_at = datetime.utcnow() - timedelta(days=days_ago)
        occurred_at = occurred_at.replace(
            hour=random.randint(0, 23),
            minute=random.randint(0, 59),
            second=random.randint(0, 59),
        )
        
        accident = {
            "id": uuid.uuid4(),
            "source_type": source_type,
            "source_id": f"{source_type.value}-{datetime.now().strftime('%Y%m%d')}-{i+1:05d}",
            "occurred_at": occurred_at,
            "location_text": f"{city['name']}市某路段",
            "latitude": Decimal(str(lat)),
            "longitude": Decimal(str(lng)),
            "geom": WKTElement(f"POINT({lng} {lat})", srid=4326),
            "vehicle_type": random.choice(["小客車", "機車", "大貨車", "公車", "行人"]),
        }
        
        accidents.append(accident)
    
    return accidents


def generate_hotspot_data(db: Session, count: int = 20) -> list[dict]:
    """產生假的熱點資料"""
    # 刷新 session 確保取得最新資料
    db.expire_all()
    # 使用簡單的查詢
    accidents = db.query(Accident).limit(50).all()
    
    if len(accidents) < 5:
        return []
    
    hotspots = []
    accidents_per_hotspot = max(5, len(accidents) // count)
    
    for i in range(min(count, len(accidents) // accidents_per_hotspot)):
        start_idx = i * accidents_per_hotspot
        end_idx = min(start_idx + accidents_per_hotspot, len(accidents))
        cluster_accidents = accidents[start_idx:end_idx]
        
        if len(cluster_accidents) < 5:
            continue
        
        # 確保正確取得屬性值
        lats = [float(str(acc.latitude)) for acc in cluster_accidents]
        lngs = [float(str(acc.longitude)) for acc in cluster_accidents]
        center_lat = sum(lats) / len(lats)
        center_lng = sum(lngs) / len(lngs)
        
        max_distance = 0
        for acc in cluster_accidents:
            lat_diff = float(str(acc.latitude)) - center_lat
            lng_diff = float(str(acc.longitude)) - center_lng
            distance = ((lat_diff ** 2 + lng_diff ** 2) ** 0.5) * 111000
            max_distance = max(max_distance, distance)
        
        radius = max(50, min(2000, int(max_distance * 1.2)))
        
        # 從 source_type 推斷事故嚴重程度（A1/A2/A3）
        a1_count = sum(1 for acc in cluster_accidents if acc.source_type == SourceType.A1)
        a2_count = sum(1 for acc in cluster_accidents if acc.source_type == SourceType.A2)
        a3_count = sum(1 for acc in cluster_accidents if acc.source_type == SourceType.A3)
        
        occurred_times = [acc.occurred_at for acc in cluster_accidents]
        earliest = min(occurred_times)
        latest = max(occurred_times)
        
        # 準備 accident_ids 為 JSON 格式（不是字串）
        accident_ids_list = [str(acc.id) for acc in cluster_accidents]
        
        hotspot = {
            "id": uuid.uuid4(),
            "center_latitude": Decimal(str(center_lat)).quantize(Decimal("0.0000001")),
            "center_longitude": Decimal(str(center_lng)).quantize(Decimal("0.0000001")),
            "geom": WKTElement(f"POINT({center_lng} {center_lat})", srid=4326),
            "radius_meters": radius,
            "total_accidents": len(cluster_accidents),
            "a1_count": a1_count,
            "a2_count": a2_count,
            "a3_count": a3_count,
            "earliest_accident_at": earliest,
            "latest_accident_at": latest,
            "analysis_date": date.today(),
            "analysis_period_start": date.today() - timedelta(days=365),
            "analysis_period_end": date.today() - timedelta(days=1),
            "accident_ids": accident_ids_list,  # JSONB 欄位直接傳入列表，SQLAlchemy 會自動轉換
        }
        
        hotspots.append(hotspot)
    
    return hotspots


def seed_data(db: Session, accident_count: int = 100, hotspot_count: int = 20, clear_existing: bool = False):
    """執行 seed 資料"""
    print(f"🌱 開始產生 seed 資料...")
    print(f"   事故記錄: {accident_count} 筆")
    print(f"   熱點記錄: {hotspot_count} 筆")
    
    if clear_existing:
        print("🗑️  清除現有資料...")
        db.execute(text("DELETE FROM hotspots;"))
        db.execute(text("DELETE FROM accidents;"))
        db.commit()
        print("✅ 資料已清除")
    
    # 產生事故資料
    print(f"\n📝 產生 {accident_count} 筆事故記錄...")
    accidents_data = generate_accident_data(accident_count)
    
    for i, acc_data in enumerate(accidents_data, 1):
        accident = Accident(**acc_data)
        db.add(accident)
        if i % 20 == 0:
            print(f"   已建立 {i}/{accident_count} 筆")
    
    db.commit()
    print(f"✅ 已建立 {len(accidents_data)} 筆事故記錄")
    
    # 產生熱點資料
    print(f"\n🔥 產生 {hotspot_count} 筆熱點記錄...")
    hotspots_data = generate_hotspot_data(db, hotspot_count)
    
    for hotspot_data in hotspots_data:
        hotspot = Hotspot(**hotspot_data)
        db.add(hotspot)
    
    db.commit()
    print(f"✅ 已建立 {len(hotspots_data)} 筆熱點記錄")
    
    print("\n✨ Seed 資料產生完成！")
    return len(accidents_data), len(hotspots_data)


def main():
    """主函數"""
    # 從命令列參數取得選項
    clear = "--clear" in sys.argv
    accident_count = 100
    hotspot_count = 20
    
    if "--help" in sys.argv or "-h" in sys.argv:
        print("用法: python -m src.scripts.seed_data [--clear] [--accidents=N] [--hotspots=N]")
        print("  --clear: 清除現有資料")
        print("  --accidents=N: 產生 N 筆事故記錄（預設: 100）")
        print("  --hotspots=N: 產生 N 筆熱點記錄（預設: 20）")
        return
    
    for arg in sys.argv[1:]:
        if arg.startswith("--accidents="):
            accident_count = int(arg.split("=")[1])
        elif arg.startswith("--hotspots="):
            hotspot_count = int(arg.split("=")[1])
    
    db = SessionLocal()
    try:
        seed_data(db, accident_count=accident_count, hotspot_count=hotspot_count, clear_existing=clear)
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
