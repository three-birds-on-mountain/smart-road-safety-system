# 資料模型設計：智慧道路守護系統

**功能**: [spec.md](spec.md) | **計劃**: [plan.md](plan.md) | **日期**: 2025-11-02

## 概述

本文件定義智慧道路守護系統的資料模型，包含事故記錄（Accident）與事故熱點（Hotspot）兩個核心實體，以及它們之間的關聯與索引策略。

**資料庫**: PostgreSQL 15 + PostGIS 3.4
**ORM**: SQLAlchemy 2.x
**空間參考系統**: WGS84 (SRID 4326)

---

## 核心實體

### 1. Accident (事故記錄)

代表單一交通事故的原始資料，整合來自A1、A2、A3三種來源的事故記錄。

#### 屬性

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| `id` | UUID | ✓ | 主鍵（自動生成） |
| `source_type` | ENUM('A1', 'A2', 'A3') | ✓ | 資料來源類型 |
| `source_id` | VARCHAR(100) | ✓ | 來源系統的原始ID |
| `occurred_at` | TIMESTAMP WITH TIME ZONE | ✓ | 事故發生時間 |
| `location_text` | TEXT |  | 地點文字描述 |
| `latitude` | NUMERIC(10, 7) | ✓ | 緯度（四捨五入至7位小數，約1.11cm精度） |
| `longitude` | NUMERIC(10, 7) | ✓ | 經度（四捨五入至7位小數，約1.11cm精度） |
| `geom` | GEOGRAPHY(POINT, 4326) | ✓ | PostGIS空間欄位（自動從經緯度生成） |
| `severity_level` | ENUM('A1', 'A2', 'A3') | ✓ | 事故嚴重程度 |
| `vehicle_type` | VARCHAR(50) |  | 車種（如「小客車」、「機車」、「行人」） |
| `raw_data` | JSONB |  | 原始JSON資料（保留完整來源資訊） |
| `geocoded` | BOOLEAN | ✓ | 是否經過地理編碼（A3資料為true） |
| `geocode_confidence` | NUMERIC(3, 2) |  | 地理編碼信心分數（0.00-1.00，僅A3適用） |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✓ | 記錄建立時間（預設：當前時間） |
| `updated_at` | TIMESTAMP WITH TIME ZONE | ✓ | 記錄更新時間（自動更新） |

#### 索引策略

```sql
-- 主鍵索引（自動）
PRIMARY KEY (id)

-- 空間索引（GIST，用於地理查詢）
CREATE INDEX idx_accident_geom ON accidents USING GIST (geom);

-- 時間索引（B-tree，用於時間範圍篩選）
CREATE INDEX idx_accident_occurred_at ON accidents (occurred_at DESC);

-- 複合索引（嚴重程度 + 時間，支援熱點分析）
CREATE INDEX idx_accident_severity_time ON accidents (severity_level, occurred_at DESC);

-- 來源唯一性約束（防止重複匯入）
CREATE UNIQUE INDEX idx_accident_source ON accidents (source_type, source_id);
```

#### 約束條件

- `latitude` 範圍: 21.5 ≤ lat ≤ 25.5（台灣緯度範圍）
- `longitude` 範圍: 119.5 ≤ lng ≤ 122.5（台灣經度範圍）
- `occurred_at` 不可為未來時間
- `geocode_confidence` 範圍: 0.00 ≤ confidence ≤ 1.00

---

### 2. Hotspot (事故熱點)

代表透過DBSCAN地理聚類分析產生的事故高風險區域。

#### 屬性

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| `id` | UUID | ✓ | 主鍵（自動生成） |
| `center_latitude` | NUMERIC(10, 7) | ✓ | 熱點中心緯度 |
| `center_longitude` | NUMERIC(10, 7) | ✓ | 熱點中心經度 |
| `geom` | GEOGRAPHY(POINT, 4326) | ✓ | PostGIS空間欄位（中心點） |
| `radius_meters` | INTEGER | ✓ | 熱點影響半徑（公尺） |
| `total_accidents` | INTEGER | ✓ | 包含的事故總數 |
| `a1_count` | INTEGER | ✓ | A1事故數量（預設：0） |
| `a2_count` | INTEGER | ✓ | A2事故數量（預設：0） |
| `a3_count` | INTEGER | ✓ | A3事故數量（預設：0） |
| `earliest_accident_at` | TIMESTAMP WITH TIME ZONE | ✓ | 最早事故發生時間 |
| `latest_accident_at` | TIMESTAMP WITH TIME ZONE | ✓ | 最近事故發生時間 |
| `analysis_date` | DATE | ✓ | 熱點分析執行日期 |
| `analysis_period_start` | DATE | ✓ | 分析資料期間起始日（預設：一年前） |
| `analysis_period_end` | DATE | ✓ | 分析資料期間結束日（預設：昨日） |
| `accident_ids` | JSONB | ✓ | 包含的事故ID清單（用於時間範圍篩選） |
| `created_at` | TIMESTAMP WITH TIME ZONE | ✓ | 記錄建立時間 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | ✓ | 記錄更新時間 |

#### 索引策略

```sql
-- 主鍵索引（自動）
PRIMARY KEY (id)

-- 空間索引（GIST，用於距離查詢）
CREATE INDEX idx_hotspot_geom ON hotspots USING GIST (geom);

-- 時間索引（B-tree，用於分析版本管理）
CREATE INDEX idx_hotspot_analysis_date ON hotspots (analysis_date DESC);

-- 複合索引（支援時間範圍篩選）
CREATE INDEX idx_hotspot_accident_time ON hotspots (earliest_accident_at, latest_accident_at);

-- 部分索引（只索引有效熱點）
CREATE INDEX idx_hotspot_active ON hotspots (analysis_date)
WHERE total_accidents >= 5;
```

#### 約束條件

- `radius_meters` 範圍: 50 ≤ radius ≤ 2000（公尺）
- `total_accidents` = `a1_count` + `a2_count` + `a3_count`
- `latest_accident_at` ≥ `earliest_accident_at`
- `analysis_period_end` ≥ `analysis_period_start`

---

## 實體關聯

### Hotspot ←→ Accident (多對多，透過 JSONB)

- **關聯方式**: Hotspot的 `accident_ids` 欄位儲存關聯的 Accident ID清單
- **設計理由**: 使用JSONB而非關聯表，因為：
  - 熱點分析每日重新計算，關聯是衍生資料
  - 查詢方向單向（從Hotspot查Accident，不需反向查詢）
  - 簡化資料模型與遷移管理

#### 查詢範例

```sql
-- 查詢熱點包含的所有事故
SELECT a.*
FROM accidents a
WHERE a.id IN (
    SELECT jsonb_array_elements_text(accident_ids)::uuid
    FROM hotspots
    WHERE id = :hotspot_id
);

-- 查詢熱點內三個月內的事故（前端時間範圍篩選）
SELECT a.*
FROM accidents a
WHERE a.id IN (
    SELECT jsonb_array_elements_text(accident_ids)::uuid
    FROM hotspots
    WHERE id = :hotspot_id
)
AND a.occurred_at >= NOW() - INTERVAL '3 months';
```

---

## 空間查詢模式

### 1. 查詢用戶附近的熱點（警示查詢）

```sql
-- 使用 ST_DWithin 查詢3公里內的熱點
SELECT
    id,
    center_latitude,
    center_longitude,
    radius_meters,
    total_accidents,
    a1_count,
    a2_count,
    a3_count,
    earliest_accident_at,
    latest_accident_at
FROM hotspots
WHERE
    -- 空間過濾（使用GIST索引）
    ST_DWithin(
        geom,
        ST_SetSRID(ST_MakePoint(:user_lng, :user_lat), 4326)::geography,
        :alert_distance_meters  -- 用戶設定的提醒距離（100/500/1000/3000）
    )
    -- 時間過濾：確保熱點包含用戶選擇時間範圍內的事故
    AND latest_accident_at >= NOW() - INTERVAL :user_time_range
    -- 使用最新分析結果
    AND analysis_date = (SELECT MAX(analysis_date) FROM hotspots);
```

### 2. 查詢地圖可視範圍內的熱點

```sql
-- 使用 ST_MakeEnvelope 建立矩形邊界
SELECT
    id,
    center_latitude,
    center_longitude,
    radius_meters,
    total_accidents,
    a1_count,
    a2_count,
    a3_count
FROM hotspots
WHERE
    geom && ST_MakeEnvelope(
        :min_lng, :min_lat,  -- 地圖西南角
        :max_lng, :max_lat,  -- 地圖東北角
        4326
    )::geography
    AND analysis_date = (SELECT MAX(analysis_date) FROM hotspots)
ORDER BY total_accidents DESC
LIMIT 500;  -- 限制回傳數量避免地圖過於擁擠
```

### 3. DBSCAN聚類查詢（每日熱點分析）

```sql
-- Step 1: 提取過去一年內的事故座標
WITH recent_accidents AS (
    SELECT
        id,
        latitude,
        longitude,
        severity_level,
        occurred_at
    FROM accidents
    WHERE occurred_at >= CURRENT_DATE - INTERVAL '1 year'
)
-- Step 2: 使用 Python/scikit-learn 執行 DBSCAN
-- (此步驟在應用層執行，查詢結果傳給 Python)
SELECT
    id,
    latitude,
    longitude,
    severity_level,
    occurred_at
FROM recent_accidents
ORDER BY occurred_at DESC;
```

---

## 資料遷移策略

### 初始化（Alembic Migration）

```python
# alembic/versions/001_create_accidents_hotspots.py

def upgrade():
    # 啟用 PostGIS 擴充
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 建立 ENUM 型別
    op.execute("""
        CREATE TYPE source_type AS ENUM ('A1', 'A2', 'A3');
        CREATE TYPE severity_level AS ENUM ('A1', 'A2', 'A3');
    """)

    # 建立 accidents 表
    op.create_table(
        'accidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('source_type', postgresql.ENUM('A1', 'A2', 'A3', name='source_type'), nullable=False),
        sa.Column('source_id', sa.String(100), nullable=False),
        sa.Column('occurred_at', sa.TIMESTAMP(timezone=True), nullable=False),
        # ... 其他欄位
    )

    # 建立空間欄位（使用 PostGIS）
    op.execute("""
        ALTER TABLE accidents
        ADD COLUMN geom GEOGRAPHY(POINT, 4326);
    """)

    # 建立索引
    op.create_index('idx_accident_geom', 'accidents', ['geom'], postgresql_using='gist')
    # ... 其他索引

    # 建立 hotspots 表（類似結構）
    # ...

def downgrade():
    op.drop_table('hotspots')
    op.drop_table('accidents')
    op.execute("DROP TYPE IF EXISTS severity_level;")
    op.execute("DROP TYPE IF EXISTS source_type;")
    op.execute("DROP EXTENSION IF EXISTS postgis;")
```

---

## 資料完整性

### Trigger: 自動更新 geom 欄位

```sql
-- 當 latitude/longitude 變更時，自動更新 geom 欄位
CREATE OR REPLACE FUNCTION update_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accidents_update_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON accidents
FOR EACH ROW
EXECUTE FUNCTION update_geom();

CREATE TRIGGER hotspots_update_geom
BEFORE INSERT OR UPDATE OF center_latitude, center_longitude ON hotspots
FOR EACH ROW
EXECUTE FUNCTION update_geom();
```

### Trigger: 自動更新 updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accidents_update_updated_at
BEFORE UPDATE ON accidents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER hotspots_update_updated_at
BEFORE UPDATE ON hotspots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

---

## 效能考量

### 查詢效能

- **空間查詢**: GIST索引支援 `ST_DWithin` 和 `&&` 運算子，查詢複雜度 O(log n)
- **時間範圍查詢**: B-tree索引支援 `>=` 和 `BETWEEN`，查詢複雜度 O(log n)
- **分頁**: 使用 `LIMIT` + `OFFSET` 或游標分頁（cursor-based pagination）

### 資料量估算

- **Accidents**: 每年 ~50萬筆，保留3年 → ~150萬筆
- **Hotspots**: 每日分析產生 ~5,000-10,000個熱點，保留90天 → ~50萬筆
- **JSONB `accident_ids`**: 平均每個熱點10個事故ID → 每筆 ~500 bytes
- **總資料庫大小**: 預估 ~2GB（含索引）

### 索引維護

```sql
-- 定期重建索引（每月執行）
REINDEX INDEX CONCURRENTLY idx_accident_geom;
REINDEX INDEX CONCURRENTLY idx_hotspot_geom;

-- 定期清理舊資料（每季執行）
DELETE FROM accidents WHERE occurred_at < NOW() - INTERVAL '3 years';
DELETE FROM hotspots WHERE analysis_date < NOW() - INTERVAL '90 days';

-- 更新統計資訊
ANALYZE accidents;
ANALYZE hotspots;
```

---

## SQLAlchemy 模型定義

### Accident Model

```python
from sqlalchemy import Column, String, DateTime, Numeric, Boolean, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography
import uuid
from datetime import datetime
import enum

class SourceType(enum.Enum):
    A1 = "A1"
    A2 = "A2"
    A3 = "A3"

class SeverityLevel(enum.Enum):
    A1 = "A1"
    A2 = "A2"
    A3 = "A3"

class Accident(Base):
    __tablename__ = "accidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type = Column(SQLEnum(SourceType), nullable=False)
    source_id = Column(String(100), nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    location_text = Column(String)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    geom = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    severity_level = Column(SQLEnum(SeverityLevel), nullable=False)
    vehicle_type = Column(String(50))
    raw_data = Column(JSONB)
    geocoded = Column(Boolean, nullable=False, default=False)
    geocode_confidence = Column(Numeric(3, 2))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_accident_geom', 'geom', postgresql_using='gist'),
        Index('idx_accident_occurred_at', 'occurred_at', postgresql_ops={'occurred_at': 'DESC'}),
        Index('idx_accident_severity_time', 'severity_level', 'occurred_at'),
        UniqueConstraint('source_type', 'source_id', name='idx_accident_source'),
    )
```

### Hotspot Model

```python
class Hotspot(Base):
    __tablename__ = "hotspots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    center_latitude = Column(Numeric(10, 7), nullable=False)
    center_longitude = Column(Numeric(10, 7), nullable=False)
    geom = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    radius_meters = Column(Integer, nullable=False)
    total_accidents = Column(Integer, nullable=False)
    a1_count = Column(Integer, nullable=False, default=0)
    a2_count = Column(Integer, nullable=False, default=0)
    a3_count = Column(Integer, nullable=False, default=0)
    earliest_accident_at = Column(DateTime(timezone=True), nullable=False)
    latest_accident_at = Column(DateTime(timezone=True), nullable=False)
    analysis_date = Column(Date, nullable=False)
    analysis_period_start = Column(Date, nullable=False)
    analysis_period_end = Column(Date, nullable=False)
    accident_ids = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_hotspot_geom', 'geom', postgresql_using='gist'),
        Index('idx_hotspot_analysis_date', 'analysis_date', postgresql_ops={'analysis_date': 'DESC'}),
        Index('idx_hotspot_accident_time', 'earliest_accident_at', 'latest_accident_at'),
        Index('idx_hotspot_active', 'analysis_date', postgresql_where='total_accidents >= 5'),
    )
```

---

## 總結

本資料模型設計考量：

1. **空間查詢效能**: 使用PostGIS的GEOGRAPHY型別與GIST索引
2. **時間範圍篩選**: 使用B-tree索引與 `latest_accident_at` 欄位支援用戶設定
3. **資料完整性**: 透過Trigger自動維護 `geom` 與 `updated_at` 欄位
4. **可擴展性**: 使用JSONB儲存原始資料與事故ID清單，保留彈性
5. **查詢最佳化**: 複合索引與部分索引減少不必要的掃描

下一步：生成 API 契約（contracts/openapi.yaml）
