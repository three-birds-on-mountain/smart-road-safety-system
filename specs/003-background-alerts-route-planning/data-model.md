# 資料模型文件：背景警示與路線規劃

**功能**: 背景警示與路線規劃
**版本**: 1.0
**建立日期**: 2025-11-08
**相關文件**: [spec.md](./spec.md) | [research.md](./research.md)

---

## 概述

本文件定義智慧道路守護系統背景警示與路線規劃功能所需的資料模型，包括實體定義、關聯關係、驗證規則、資料庫架構和狀態機。

### 核心實體清單

1. **路線 (Route)** - 使用者規劃的行駛路線
2. **路線事故統計 (RouteSafetySummary)** - 路線安全性評估資訊
3. **背景警示設定 (BackgroundAlertSettings)** - 使用者的警示偏好設定
4. **搜尋記錄 (SearchHistory)** - 使用者的地址搜尋歷史
5. **警示日誌 (AlertLog)** - 觸發的警示記錄
6. **使用者偏好設定 (UserPreferences)** - 使用者的全域偏好設定

---

## 1. 路線 (Route)

### 實體描述
代表使用者規劃的從起點到目的地的行駛路徑，包含完整的路徑幾何資訊、距離、時間預估等。

### 欄位定義

#### Backend (Python/PostgreSQL)
```python
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class Route(BaseModel):
    id: int = Field(description="路線唯一識別碼")
    user_id: int = Field(description="使用者 ID")
    origin_address: str = Field(max_length=500, description="起點地址")
    origin_lat: float = Field(ge=-90, le=90, description="起點緯度")
    origin_lng: float = Field(ge=-180, le=180, description="起點經度")
    destination_address: str = Field(max_length=500, description="目的地地址")
    destination_lat: float = Field(ge=-90, le=90, description="目的地緯度")
    destination_lng: float = Field(ge=-180, le=180, description="目的地經度")
    route_geom: str = Field(description="路線幾何 (WKT 格式 LineString)")
    distance_meters: float = Field(gt=0, description="路線總距離（公尺）")
    duration_seconds: float = Field(gt=0, description="預估行駛時間（秒）")
    profile: str = Field(default="driving-traffic", description="導航模式")
    hotspot_ids: List[int] = Field(default_factory=list, description="路線經過的事故熱點 ID 清單")
    created_at: datetime = Field(description="建立時間")
    updated_at: datetime = Field(description="更新時間")
    is_active: bool = Field(default=False, description="是否為目前使用中的路線")
```

#### Frontend (TypeScript)
```typescript
interface Route {
  id: number;
  userId: number;
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  routeGeom: GeoJSON.LineString; // GeoJSON 格式
  distanceMeters: number;
  durationSeconds: number;
  profile: 'driving-traffic' | 'driving' | 'walking' | 'cycling';
  hotspotIds: number[];
  createdAt: string; // ISO 8601 格式
  updatedAt: string;
  isActive: boolean;
}
```

### 驗證規則

- **VR-R1**: `origin_lat`, `origin_lng`, `destination_lat`, `destination_lng` 必須為有效的 WGS84 座標
- **VR-R2**: `route_geom` 必須為有效的 LineString 幾何，至少包含 2 個座標點
- **VR-R3**: `distance_meters` 必須大於 0
- **VR-R4**: `duration_seconds` 必須大於 0
- **VR-R5**: `profile` 必須為以下值之一: `driving-traffic`, `driving`, `walking`, `cycling`
- **VR-R6**: 每位使用者同時只能有一條 `is_active = true` 的路線

### 關聯關係

- **與 User**: 多對一關聯 (一位使用者可建立多條路線)
- **與 Hotspot**: 多對多關聯 (透過 `hotspot_ids` 陣列)
- **與 RouteSafetySummary**: 一對一關聯 (每條路線有一份安全性統計)

### 資料庫架構 (PostgreSQL + PostGIS)

```sql
-- 建立路線資料表
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_address VARCHAR(500) NOT NULL,
    origin_lat DOUBLE PRECISION NOT NULL CHECK (origin_lat BETWEEN -90 AND 90),
    origin_lng DOUBLE PRECISION NOT NULL CHECK (origin_lng BETWEEN -180 AND 180),
    destination_address VARCHAR(500) NOT NULL,
    destination_lat DOUBLE PRECISION NOT NULL CHECK (destination_lat BETWEEN -90 AND 90),
    destination_lng DOUBLE PRECISION NOT NULL CHECK (destination_lng BETWEEN -180 AND 180),
    route_geom GEOGRAPHY(LINESTRING, 4326) NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL CHECK (distance_meters > 0),
    duration_seconds DOUBLE PRECISION NOT NULL CHECK (duration_seconds > 0),
    profile VARCHAR(20) NOT NULL DEFAULT 'driving-traffic'
        CHECK (profile IN ('driving-traffic', 'driving', 'walking', 'cycling')),
    hotspot_ids INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE
);

-- 建立索引
CREATE INDEX idx_routes_user_id ON routes(user_id);
CREATE INDEX idx_routes_created_at ON routes(created_at DESC);
CREATE INDEX idx_routes_is_active ON routes(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_routes_geom ON routes USING GIST(route_geom);

-- 建立觸發器：確保每位使用者只有一條 is_active 路線
CREATE OR REPLACE FUNCTION enforce_single_active_route()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        UPDATE routes
        SET is_active = FALSE
        WHERE user_id = NEW.user_id
          AND id != NEW.id
          AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_active_route
BEFORE INSERT OR UPDATE ON routes
FOR EACH ROW
EXECUTE FUNCTION enforce_single_active_route();

-- 建立觸發器：自動更新 updated_at
CREATE TRIGGER trg_routes_updated_at
BEFORE UPDATE ON routes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### 使用範例

#### 建立路線
```sql
INSERT INTO routes (
    user_id,
    origin_address,
    origin_lat,
    origin_lng,
    destination_address,
    destination_lat,
    destination_lng,
    route_geom,
    distance_meters,
    duration_seconds,
    profile,
    is_active
) VALUES (
    1,
    '台北市信義區市府路1號',
    25.0408,
    121.5678,
    '台北市中正區重慶南路一段122號',
    25.0448,
    121.5154,
    ST_GeogFromText('LINESTRING(121.5678 25.0408, 121.5654 25.0420, 121.5154 25.0448)'),
    5234.5,
    892.3,
    'driving-traffic',
    TRUE
);
```

#### 查詢路線經過的事故熱點 (200 公尺內)
```sql
WITH active_route AS (
    SELECT * FROM routes
    WHERE user_id = 1 AND is_active = TRUE
    LIMIT 1
)
SELECT
    h.id,
    h.location_name,
    h.severity,
    h.total_count,
    ST_Distance(h.geom, ar.route_geom) as distance_meters
FROM hotspots h
CROSS JOIN active_route ar
WHERE ST_DWithin(h.geom, ar.route_geom, 200)
  AND h.total_count >= 1  -- 根據使用者設定的數量篩選
ORDER BY distance_meters ASC;
```

---

## 2. 路線事故統計 (RouteSafetySummary)

### 實體描述
路線安全性評估資訊，包含路線經過的事故總數、各等級分類、風險評分以及是否建議改用大眾交通工具。

### 欄位定義

#### Backend (Python/PostgreSQL)
```python
class RouteSafetySummary(BaseModel):
    id: int = Field(description="統計資料唯一識別碼")
    route_id: int = Field(description="路線 ID")
    total_accidents: int = Field(ge=0, description="路線經過的總事故數")
    a1_count: int = Field(ge=0, description="A1 等級事故數 (死亡)")
    a2_count: int = Field(ge=0, description="A2 等級事故數 (受傷)")
    a3_count: int = Field(ge=0, description="A3 等級事故數 (財損)")
    risk_score: float = Field(ge=0, description="風險評分 (加權計算)")
    suggest_public_transport: bool = Field(description="是否建議使用大眾交通工具")
    created_at: datetime = Field(description="建立時間")
    updated_at: datetime = Field(description="更新時間")
```

#### Frontend (TypeScript)
```typescript
interface RouteSafetySummary {
  id: number;
  routeId: number;
  totalAccidents: number;
  a1Count: number;
  a2Count: number;
  a3Count: number;
  riskScore: number;
  suggestPublicTransport: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 驗證規則

- **VR-RS1**: `total_accidents` = `a1_count` + `a2_count` + `a3_count`
- **VR-RS2**: `risk_score` = `a1_count * 3 + a2_count * 2 + a3_count * 1` (加權公式)
- **VR-RS3**: `suggest_public_transport` = `risk_score > 15` (閾值可調整)
- **VR-RS4**: 所有計數欄位必須 >= 0

### 關聯關係

- **與 Route**: 一對一關聯 (每條路線對應一份統計)

### 資料庫架構

```sql
-- 建立路線事故統計資料表
CREATE TABLE route_safety_summaries (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,
    total_accidents INTEGER NOT NULL DEFAULT 0 CHECK (total_accidents >= 0),
    a1_count INTEGER NOT NULL DEFAULT 0 CHECK (a1_count >= 0),
    a2_count INTEGER NOT NULL DEFAULT 0 CHECK (a2_count >= 0),
    a3_count INTEGER NOT NULL DEFAULT 0 CHECK (a3_count >= 0),
    risk_score DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (risk_score >= 0),
    suggest_public_transport BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 約束條件：總數 = 各等級加總
    CONSTRAINT chk_total_equals_sum CHECK (
        total_accidents = (a1_count + a2_count + a3_count)
    )
);

-- 建立索引
CREATE INDEX idx_route_safety_route_id ON route_safety_summaries(route_id);
CREATE INDEX idx_route_safety_risk_score ON route_safety_summaries(risk_score DESC);

-- 建立觸發器：自動計算 risk_score 和 suggest_public_transport
CREATE OR REPLACE FUNCTION calculate_route_risk_score()
RETURNS TRIGGER AS $$
DECLARE
    calculated_score DOUBLE PRECISION;
BEGIN
    -- 加權計算：A1=3分、A2=2分、A3=1分
    calculated_score := (NEW.a1_count * 3.0) + (NEW.a2_count * 2.0) + (NEW.a3_count * 1.0);

    NEW.risk_score := calculated_score;
    NEW.suggest_public_transport := (calculated_score > 15);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_route_risk_score
BEFORE INSERT OR UPDATE ON route_safety_summaries
FOR EACH ROW
EXECUTE FUNCTION calculate_route_risk_score();

-- 建立觸發器：自動更新 updated_at
CREATE TRIGGER trg_route_safety_updated_at
BEFORE UPDATE ON route_safety_summaries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### 使用範例

#### 建立路線統計
```sql
-- 插入統計資料（risk_score 和 suggest_public_transport 會自動計算）
INSERT INTO route_safety_summaries (
    route_id,
    total_accidents,
    a1_count,
    a2_count,
    a3_count
) VALUES (
    1,
    12,
    2,
    5,
    5
);
-- 結果: risk_score = 2*3 + 5*2 + 5*1 = 21, suggest_public_transport = TRUE
```

#### 查詢路線及其安全統計
```sql
SELECT
    r.id,
    r.origin_address,
    r.destination_address,
    r.distance_meters,
    rss.total_accidents,
    rss.a1_count,
    rss.a2_count,
    rss.a3_count,
    rss.risk_score,
    rss.suggest_public_transport
FROM routes r
LEFT JOIN route_safety_summaries rss ON r.id = rss.route_id
WHERE r.user_id = 1 AND r.is_active = TRUE;
```

---

## 3. 背景警示設定 (BackgroundAlertSettings)

### 實體描述
使用者的警示偏好設定，包含警示方式（震動、音效、兩者或關閉）和事故數量篩選閾值。

### 欄位定義

#### Backend (Python/PostgreSQL)
```python
from enum import Enum

class AlertMode(str, Enum):
    VIBRATION_ONLY = "vibration_only"
    SOUND_ONLY = "sound_only"
    BOTH = "both"
    DISABLED = "disabled"

class BackgroundAlertSettings(BaseModel):
    id: int = Field(description="設定唯一識別碼")
    user_id: int = Field(description="使用者 ID")
    alert_mode: AlertMode = Field(default=AlertMode.BOTH, description="警示方式")
    accident_threshold: int = Field(default=1, ge=1, le=10, description="事故數量篩選閾值")
    alert_distance_meters: int = Field(default=200, ge=50, le=500, description="警示距離（公尺）")
    is_enabled: bool = Field(default=True, description="是否啟用背景警示")
    created_at: datetime = Field(description="建立時間")
    updated_at: datetime = Field(description="更新時間")
```

#### Frontend (TypeScript)
```typescript
type AlertMode = 'vibration_only' | 'sound_only' | 'both' | 'disabled';

interface BackgroundAlertSettings {
  id: number;
  userId: number;
  alertMode: AlertMode;
  accidentThreshold: number; // 1-10
  alertDistanceMeters: number; // 50-500
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 驗證規則

- **VR-BAS1**: `accident_threshold` 必須在 1-10 之間
- **VR-BAS2**: `alert_distance_meters` 必須在 50-500 之間
- **VR-BAS3**: `alert_mode` 必須為 `vibration_only`, `sound_only`, `both`, `disabled` 之一
- **VR-BAS4**: 每位使用者只能有一筆設定記錄

### 關聯關係

- **與 User**: 一對一關聯 (每位使用者一份設定)

### 資料庫架構

```sql
-- 建立警示設定資料表
CREATE TABLE background_alert_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    alert_mode VARCHAR(20) NOT NULL DEFAULT 'both'
        CHECK (alert_mode IN ('vibration_only', 'sound_only', 'both', 'disabled')),
    accident_threshold INTEGER NOT NULL DEFAULT 1
        CHECK (accident_threshold BETWEEN 1 AND 10),
    alert_distance_meters INTEGER NOT NULL DEFAULT 200
        CHECK (alert_distance_meters BETWEEN 50 AND 500),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE UNIQUE INDEX idx_alert_settings_user_id ON background_alert_settings(user_id);

-- 建立觸發器：自動更新 updated_at
CREATE TRIGGER trg_alert_settings_updated_at
BEFORE UPDATE ON background_alert_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### 預設值設定

當新使用者註冊時，自動建立預設的警示設定：

```sql
-- 建立觸發器：新使用者自動建立預設設定
CREATE OR REPLACE FUNCTION create_default_alert_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO background_alert_settings (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_default_alert_settings
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_alert_settings();
```

### 使用範例

#### 更新警示設定
```sql
UPDATE background_alert_settings
SET
    alert_mode = 'sound_only',
    accident_threshold = 3,
    alert_distance_meters = 250
WHERE user_id = 1;
```

#### 查詢使用者的警示設定
```sql
SELECT * FROM background_alert_settings
WHERE user_id = 1;
```

---

## 4. 搜尋記錄 (SearchHistory)

### 實體描述
使用者搜尋過的地址記錄，用於提供自動完成建議和快速重選常用地點。

### 欄位定義

#### Backend (Python/PostgreSQL)
```python
class SearchHistory(BaseModel):
    id: int = Field(description="搜尋記錄唯一識別碼")
    user_id: int = Field(description="使用者 ID")
    address: str = Field(max_length=500, description="搜尋的地址")
    lat: float = Field(ge=-90, le=90, description="地址緯度")
    lng: float = Field(ge=-180, le=180, description="地址經度")
    search_count: int = Field(ge=1, description="搜尋次數")
    last_searched_at: datetime = Field(description="最後搜尋時間")
    created_at: datetime = Field(description="首次搜尋時間")
```

#### Frontend (TypeScript)
```typescript
interface SearchHistory {
  id: number;
  userId: number;
  address: string;
  lat: number;
  lng: number;
  searchCount: number;
  lastSearchedAt: string;
  createdAt: string;
}
```

### 驗證規則

- **VR-SH1**: `address` 不可為空字串
- **VR-SH2**: `lat`, `lng` 必須為有效的 WGS84 座標
- **VR-SH3**: `search_count` 必須 >= 1
- **VR-SH4**: 同一使用者的相同地址只保留一筆記錄（使用 UNIQUE 約束）

### 關聯關係

- **與 User**: 多對一關聯 (一位使用者可有多筆搜尋記錄)

### 資料庫架構

```sql
-- 建立搜尋記錄資料表
CREATE TABLE search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(500) NOT NULL,
    lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    search_count INTEGER NOT NULL DEFAULT 1 CHECK (search_count >= 1),
    last_searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一約束：同一使用者不重複儲存相同地址
    CONSTRAINT uk_user_address UNIQUE (user_id, address)
);

-- 建立索引
CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_last_searched ON search_history(user_id, last_searched_at DESC);
CREATE INDEX idx_search_history_count ON search_history(user_id, search_count DESC);

-- 建立全文搜尋索引（用於地址自動完成）
CREATE INDEX idx_search_history_address_trgm ON search_history
USING gin (address gin_trgm_ops);
```

### 使用範例

#### 插入或更新搜尋記錄 (upsert)
```sql
INSERT INTO search_history (user_id, address, lat, lng)
VALUES (1, '台北市信義區市府路1號', 25.0408, 121.5678)
ON CONFLICT (user_id, address)
DO UPDATE SET
    search_count = search_history.search_count + 1,
    last_searched_at = NOW();
```

#### 查詢使用者最常搜尋的地址（前 10 筆）
```sql
SELECT address, lat, lng, search_count
FROM search_history
WHERE user_id = 1
ORDER BY search_count DESC, last_searched_at DESC
LIMIT 10;
```

#### 地址自動完成建議
```sql
-- 需先安裝 pg_trgm 擴展
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT address, lat, lng
FROM search_history
WHERE user_id = 1
  AND address % '市府路'  -- 相似度搜尋
ORDER BY similarity(address, '市府路') DESC
LIMIT 5;
```

---

## 5. 警示日誌 (AlertLog)

### 實體描述
記錄系統觸發的所有警示事件，用於分析使用者行為、改善警示準確度和除錯。

### 欄位定義

#### Backend (Python/PostgreSQL)
```python
class AlertLog(BaseModel):
    id: int = Field(description="警示日誌唯一識別碼")
    user_id: int = Field(description="使用者 ID")
    hotspot_id: int = Field(description="觸發警示的事故熱點 ID")
    route_id: Optional[int] = Field(None, description="相關路線 ID (若有)")
    alert_type: str = Field(description="警示類型")
    user_lat: float = Field(ge=-90, le=90, description="使用者當時緯度")
    user_lng: float = Field(ge=-180, le=180, description="使用者當時經度")
    distance_to_hotspot: float = Field(ge=0, description="與熱點的距離（公尺）")
    triggered_at: datetime = Field(description="觸發時間")
```

#### Frontend (TypeScript)
```typescript
type AlertType = 'proximity' | 'route_planning';

interface AlertLog {
  id: number;
  userId: number;
  hotspotId: number;
  routeId?: number;
  alertType: AlertType;
  userLat: number;
  userLng: number;
  distanceToHotspot: number;
  triggeredAt: string;
}
```

### 驗證規則

- **VR-AL1**: `alert_type` 必須為 `proximity` (接近警示) 或 `route_planning` (路線規劃警示)
- **VR-AL2**: `distance_to_hotspot` 必須 >= 0
- **VR-AL3**: `user_lat`, `user_lng` 必須為有效的 WGS84 座標

### 關聯關係

- **與 User**: 多對一關聯
- **與 Hotspot**: 多對一關聯
- **與 Route**: 多對一關聯（可選）

### 資料庫架構

```sql
-- 建立警示日誌資料表
CREATE TABLE alert_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hotspot_id INTEGER NOT NULL REFERENCES hotspots(id) ON DELETE CASCADE,
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('proximity', 'route_planning')),
    user_lat DOUBLE PRECISION NOT NULL CHECK (user_lat BETWEEN -90 AND 90),
    user_lng DOUBLE PRECISION NOT NULL CHECK (user_lng BETWEEN -180 AND 180),
    distance_to_hotspot DOUBLE PRECISION NOT NULL CHECK (distance_to_hotspot >= 0),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX idx_alert_logs_user_id ON alert_logs(user_id);
CREATE INDEX idx_alert_logs_triggered_at ON alert_logs(triggered_at DESC);
CREATE INDEX idx_alert_logs_hotspot_id ON alert_logs(hotspot_id);
CREATE INDEX idx_alert_logs_route_id ON alert_logs(route_id) WHERE route_id IS NOT NULL;

-- 建立分區表（按月分區，提升長期資料查詢效能）
-- PostgreSQL 12+ 支援
CREATE TABLE alert_logs_2025_11 PARTITION OF alert_logs
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

### 資料保留政策

為避免日誌資料無限增長，建議定期清理舊資料：

```sql
-- 刪除 90 天前的警示日誌
DELETE FROM alert_logs
WHERE triggered_at < NOW() - INTERVAL '90 days';
```

### 使用範例

#### 記錄接近警示
```sql
INSERT INTO alert_logs (
    user_id,
    hotspot_id,
    alert_type,
    user_lat,
    user_lng,
    distance_to_hotspot
) VALUES (
    1,
    42,
    'proximity',
    25.0420,
    121.5654,
    185.3
);
```

#### 查詢使用者過去 7 天的警示次數
```sql
SELECT
    DATE(triggered_at) as date,
    COUNT(*) as alert_count
FROM alert_logs
WHERE user_id = 1
  AND triggered_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(triggered_at)
ORDER BY date DESC;
```

#### 查詢最常觸發警示的熱點
```sql
SELECT
    h.id,
    h.location_name,
    COUNT(*) as alert_count
FROM alert_logs al
JOIN hotspots h ON al.hotspot_id = h.id
WHERE al.triggered_at >= NOW() - INTERVAL '30 days'
GROUP BY h.id, h.location_name
ORDER BY alert_count DESC
LIMIT 10;
```

---

## 6. 使用者偏好設定 (UserPreferences)

### 實體描述
使用者的全域偏好設定，包括地圖顯示、導航模式、省電模式等。

### 欄位定義

#### Backend (Python/PostgreSQL)
```python
class UserPreferences(BaseModel):
    id: int = Field(description="偏好設定唯一識別碼")
    user_id: int = Field(description="使用者 ID")
    default_profile: str = Field(default="driving-traffic", description="預設導航模式")
    keep_screen_on: bool = Field(default=False, description="是否保持螢幕喚醒")
    battery_saver_mode: bool = Field(default=False, description="省電模式")
    show_all_severity_levels: bool = Field(default=True, description="是否顯示所有嚴重程度等級")
    severity_filter: List[str] = Field(default=["A1", "A2", "A3"], description="事故嚴重程度篩選")
    created_at: datetime = Field(description="建立時間")
    updated_at: datetime = Field(description="更新時間")
```

#### Frontend (TypeScript)
```typescript
type NavigationProfile = 'driving-traffic' | 'driving' | 'walking' | 'cycling';
type SeverityLevel = 'A1' | 'A2' | 'A3';

interface UserPreferences {
  id: number;
  userId: number;
  defaultProfile: NavigationProfile;
  keepScreenOn: boolean;
  batterySaverMode: boolean;
  showAllSeverityLevels: boolean;
  severityFilter: SeverityLevel[];
  createdAt: string;
  updatedAt: string;
}
```

### 驗證規則

- **VR-UP1**: `default_profile` 必須為 `driving-traffic`, `driving`, `walking`, `cycling` 之一
- **VR-UP2**: `severity_filter` 中的每個值必須為 `A1`, `A2`, `A3` 之一
- **VR-UP3**: `severity_filter` 不可為空陣列（至少顯示一種等級）
- **VR-UP4**: 每位使用者只能有一筆偏好設定

### 關聯關係

- **與 User**: 一對一關聯

### 資料庫架構

```sql
-- 建立使用者偏好設定資料表
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    default_profile VARCHAR(20) NOT NULL DEFAULT 'driving-traffic'
        CHECK (default_profile IN ('driving-traffic', 'driving', 'walking', 'cycling')),
    keep_screen_on BOOLEAN NOT NULL DEFAULT FALSE,
    battery_saver_mode BOOLEAN NOT NULL DEFAULT FALSE,
    show_all_severity_levels BOOLEAN NOT NULL DEFAULT TRUE,
    severity_filter TEXT[] NOT NULL DEFAULT ARRAY['A1', 'A2', 'A3']
        CHECK (array_length(severity_filter, 1) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE UNIQUE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- 建立觸發器：新使用者自動建立預設偏好
CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_default_user_preferences
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_user_preferences();

-- 建立觸發器：自動更新 updated_at
CREATE TRIGGER trg_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### 使用範例

#### 更新使用者偏好
```sql
UPDATE user_preferences
SET
    keep_screen_on = TRUE,
    battery_saver_mode = FALSE,
    severity_filter = ARRAY['A1', 'A2']
WHERE user_id = 1;
```

---

## 狀態機 (State Machines)

### 路線狀態機

路線在其生命週期中會經歷以下狀態：

```
[建立中] → [活動中] → [已完成/已取消]
   ↓
[錯誤]
```

#### 狀態定義

1. **建立中 (Creating)**: 正在呼叫 Mapbox API 規劃路線
2. **活動中 (Active)**: 路線已規劃完成，使用者正在使用
3. **已完成 (Completed)**: 使用者已到達目的地或結束導航
4. **已取消 (Cancelled)**: 使用者中途取消路線
5. **錯誤 (Error)**: 路線規劃失敗

#### 狀態轉換

```
Creating → Active: 路線規劃成功
Creating → Error: API 呼叫失敗或路線無法規劃
Active → Completed: 使用者完成導航
Active → Cancelled: 使用者取消導航
Active → Error: 導航過程中發生錯誤
```

#### 實作建議

在 `routes` 表中新增 `status` 欄位：

```sql
ALTER TABLE routes
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating', 'active', 'completed', 'cancelled', 'error'));

CREATE INDEX idx_routes_status ON routes(status);
```

### 警示狀態機

警示在觸發過程中的狀態流轉：

```
[待觸發] → [已觸發] → [已確認/已忽略]
```

#### 狀態定義

1. **待觸發 (Pending)**: 使用者接近熱點但尚未進入警示範圍
2. **已觸發 (Triggered)**: 警示已觸發（震動/音效/視覺）
3. **已確認 (Acknowledged)**: 使用者已確認警示
4. **已忽略 (Ignored)**: 警示超時未確認

#### 冷卻機制

為避免同一熱點重複觸發警示，實作冷卻機制：

```sql
-- 檢查是否需要觸發警示（5 分鐘內不重複警示同一熱點）
SELECT COUNT(*)
FROM alert_logs
WHERE user_id = 1
  AND hotspot_id = 42
  AND triggered_at >= NOW() - INTERVAL '5 minutes';
-- 若 COUNT > 0，則不觸發警示
```

---

## 實體關聯圖 (Entity Relationship Diagram)

```
┌─────────────────┐
│     Users       │
└────────┬────────┘
         │
         │ 1:1
         ├──────────────────────────────┐
         │                              │
         │ 1:1                          │ 1:N
         ▼                              ▼
┌─────────────────────┐      ┌────────────────────┐
│ BackgroundAlert     │      │    Routes          │
│ Settings            │      └────────┬───────────┘
└─────────────────────┘               │
         │                            │ 1:1
         │ 1:1                        ▼
         │                   ┌────────────────────┐
         │                   │ RouteSafety        │
         │                   │ Summaries          │
         │                   └────────────────────┘
         │                            │
         │ 1:1                        │ N:M
         ▼                            ▼
┌─────────────────────┐      ┌────────────────────┐
│  UserPreferences    │      │    Hotspots        │
└─────────────────────┘      └────────┬───────────┘
                                      │
         ┌────────────────────────────┤
         │                            │
         │ N:1                        │ N:1
         ▼                            ▼
┌─────────────────────┐      ┌────────────────────┐
│  SearchHistory      │      │    AlertLogs       │
└─────────────────────┘      └────────────────────┘
```

---

## 資料庫初始化腳本

### 通用函式

```sql
-- 建立 updated_at 自動更新函式
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 啟用必要的 PostgreSQL 擴展

```sql
-- PostGIS 用於空間資料處理
CREATE EXTENSION IF NOT EXISTS postgis;

-- pg_trgm 用於相似度搜尋
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 完整初始化順序

1. 啟用擴展
2. 建立通用函式
3. 建立資料表（依相依順序）
4. 建立索引
5. 建立觸發器
6. 建立約束

---

## 資料遷移注意事項

### 從現有系統遷移

若系統已有 `hotspots` 資料表，需確保：

1. **座標系統一致**: 確認使用 SRID 4326 (WGS84)
2. **幾何類型**: `geom` 欄位為 `GEOGRAPHY(POINT, 4326)`
3. **空間索引**: 已建立 GIST 索引

### 資料驗證

```sql
-- 驗證座標有效性
SELECT id, location_name
FROM hotspots
WHERE geom IS NULL
   OR ST_X(geom::geometry) NOT BETWEEN -180 AND 180
   OR ST_Y(geom::geometry) NOT BETWEEN -90 AND 90;

-- 驗證空間索引存在
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'hotspots' AND indexdef LIKE '%GIST%';
```

---

## 效能最佳化建議

### 1. 定期維護

```sql
-- 每週執行一次 VACUUM ANALYZE
VACUUM ANALYZE routes;
VACUUM ANALYZE hotspots;
VACUUM ANALYZE alert_logs;

-- 每月執行一次 CLUSTER（空間索引）
CLUSTER hotspots USING idx_hotspots_geom;
CLUSTER routes USING idx_routes_geom;
```

### 2. 查詢最佳化

- 使用 `EXPLAIN ANALYZE` 檢查查詢計畫
- 確保空間查詢使用索引（Index Scan，非 Seq Scan）
- 適當使用 `LIMIT` 限制回傳筆數

### 3. 連線池設定

```python
# FastAPI + SQLAlchemy
DATABASE_URL = "postgresql://user:pass@localhost/roadguard"
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # 基本連線數
    max_overflow=10,       # 最大溢出連線數
    pool_pre_ping=True,    # 連線健康檢查
    pool_recycle=3600      # 每小時回收連線
)
```

---

## API 回應格式範例

### 取得路線及安全統計

**Request**: `GET /api/routes/{route_id}`

**Response**:
```json
{
  "route": {
    "id": 1,
    "userId": 1,
    "originAddress": "台北市信義區市府路1號",
    "originLat": 25.0408,
    "originLng": 121.5678,
    "destinationAddress": "台北市中正區重慶南路一段122號",
    "destinationLat": 25.0448,
    "destinationLng": 121.5154,
    "routeGeom": {
      "type": "LineString",
      "coordinates": [
        [121.5678, 25.0408],
        [121.5654, 25.0420],
        [121.5154, 25.0448]
      ]
    },
    "distanceMeters": 5234.5,
    "durationSeconds": 892.3,
    "profile": "driving-traffic",
    "isActive": true,
    "createdAt": "2025-11-08T10:30:00Z",
    "updatedAt": "2025-11-08T10:30:00Z"
  },
  "safetySummary": {
    "totalAccidents": 12,
    "a1Count": 2,
    "a2Count": 5,
    "a3Count": 5,
    "riskScore": 21.0,
    "suggestPublicTransport": true
  },
  "hotspots": [
    {
      "id": 42,
      "locationName": "忠孝東路與敦化南路口",
      "severity": "A1",
      "totalCount": 5,
      "distanceToRoute": 85.3
    }
  ]
}
```

---

## 總結

本資料模型文件定義了背景警示與路線規劃功能所需的 6 個核心實體：

1. **Route**: 路線規劃的核心實體
2. **RouteSafetySummary**: 路線安全性評估
3. **BackgroundAlertSettings**: 使用者警示偏好
4. **SearchHistory**: 搜尋歷史記錄
5. **AlertLog**: 警示事件日誌
6. **UserPreferences**: 使用者全域偏好

所有實體皆包含：
- 完整的欄位定義（Backend 和 Frontend）
- 驗證規則
- 關聯關係
- PostgreSQL + PostGIS 資料庫架構
- 索引和觸發器
- 使用範例

資料庫設計重點：
- 使用 PostGIS GEOGRAPHY 類型處理空間資料
- GIST 索引支援高效能空間查詢
- 觸發器自動維護資料一致性
- 適當的約束條件確保資料品質

---

**文件版本**: 1.0
**最後更新**: 2025-11-08
**維護者**: Development Team
