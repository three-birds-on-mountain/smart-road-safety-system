# 熱點 API 重構摘要

## 概述

此次重構簡化了熱點 API，支援多時間段分析（365/180/90/30 天），並新增了 `analysis_period_days` 欄位來追蹤分析期間。

## 資料庫變更

### 新增欄位

在 `hotspots` 表新增：
- `analysis_period_days` (INTEGER, NOT NULL) - 分析期間天數

### Migration

```bash
cd backend
alembic upgrade head
```

Migration 檔案：`002_add_analysis_period_days.py`

## API 變更

### 已移除的端點

1. ❌ `GET /api/v1/hotspots/nearby` - 查詢用戶附近的熱點
2. ❌ `GET /api/v1/hotspots/in-bounds` - 查詢地圖範圍內的熱點

### 新增的端點

#### `GET /api/v1/hotspots/all`

查詢所有熱點（取代 nearby 和 in-bounds）。

**參數：**
- `period_days` (可選): 分析期間天數，允許值：`30`, `90`, `180`, `365`（預設：365）
- `severity_levels` (可選): 嚴重程度篩選，如 `A1,A2`
- `limit` (可選): 最多回傳數量（預設：1000，最大：5000）

**範例：**

```bash
# 查詢 365 天的所有熱點（預設）
GET /api/v1/hotspots/all

# 查詢 90 天的所有熱點
GET /api/v1/hotspots/all?period_days=90

# 只查詢 A1（死亡）和 A2（受傷）事故熱點
GET /api/v1/hotspots/all?period_days=365&severity_levels=A1,A2

# 限制回傳數量
GET /api/v1/hotspots/all?limit=100
```

**回應格式：**

```json
{
  "data": [
    {
      "id": "uuid",
      "center_latitude": 25.0421,
      "center_longitude": 121.5654,
      "radius_meters": 500,
      "total_accidents": 25,
      "a1_count": 2,
      "a2_count": 15,
      "a3_count": 8,
      "earliest_accident_at": "2024-01-01T10:30:00+08:00",
      "latest_accident_at": "2024-11-07T15:45:00+08:00",
      "analysis_period_days": 365,
      "severity_score": 58.0
    }
  ],
  "meta": {
    "total_count": 156,
    "period_days": 365
  }
}
```

### 更新的端點

#### `GET /api/v1/hotspots/{hotspot_id}`

查詢單一熱點詳細資訊（已更新）。

**變更：**
- ✅ 新增 `analysis_period_days` 欄位到回應
- ✅ 實作 `include_accidents` 參數，可查詢熱點內的所有事故

**參數：**
- `include_accidents` (可選): 是否包含事故記錄列表（預設：false）

**範例：**

```bash
# 查詢熱點基本資訊
GET /api/v1/hotspots/{hotspot_id}

# 查詢熱點及其包含的所有事故
GET /api/v1/hotspots/{hotspot_id}?include_accidents=true
```

**回應格式（include_accidents=true）：**

```json
{
  "data": {
    "id": "uuid",
    "center_latitude": 25.0421,
    "center_longitude": 121.5654,
    "radius_meters": 500,
    "total_accidents": 25,
    "a1_count": 2,
    "a2_count": 15,
    "a3_count": 8,
    "earliest_accident_at": "2024-01-01T10:30:00+08:00",
    "latest_accident_at": "2024-11-07T15:45:00+08:00",
    "analysis_date": "2024-11-08",
    "analysis_period_days": 365,
    "analysis_period_start": "2023-11-08",
    "analysis_period_end": "2024-11-07",
    "severity_score": 58.0,
    "accidents": [
      {
        "id": "uuid",
        "source_type": "A2",
        "source_id": "12345",
        "occurred_at": "2024-11-07T15:45:00+08:00",
        "location_text": "台北市信義區信義路五段7號",
        "latitude": 25.0421,
        "longitude": 121.5654,
        "vehicle_type": "機車"
      }
    ]
  }
}
```

## ETL 腳本變更

### `generate_hotspots.py`

支援生成多個時間段的熱點分析。

**使用方式：**

```bash
# 生成 365 天的熱點分析
uv run python data/generate_hotspots.py \
  --database-url "$DATABASE_URL" \
  --period-days 365 \
  --epsilon-meters 200 \
  --min-accidents 5

# 生成 90 天的熱點分析
uv run python data/generate_hotspots.py \
  --database-url "$DATABASE_URL" \
  --period-days 90 \
  --epsilon-meters 200 \
  --min-accidents 5

# 生成所有時間段的熱點分析
for days in 365 180 90 30; do
  uv run python data/generate_hotspots.py \
    --database-url "$DATABASE_URL" \
    --period-days $days \
    --epsilon-meters 200 \
    --min-accidents 1
done
```

**重要修正：**
- ✅ 修正 DBSCAN epsilon 單位轉換錯誤（從度數改為弧度）
- ✅ 新增 `analysis_period_days` 欄位到熱點記錄

## 部署步驟

### 1. 執行資料庫 Migration

```bash
cd backend
alembic upgrade head
```

### 2. 重新生成熱點資料（建議）

因為新增了 `analysis_period_days` 欄位，建議重新生成熱點資料：

```bash
# 清除舊資料並生成新的熱點分析
for days in 365 180 90 30; do
  uv run python data/generate_hotspots.py \
    --database-url "$DATABASE_URL" \
    --period-days $days \
    --epsilon-meters 200 \
    --min-accidents 5 \
    --clear-existing  # 只在第一次執行時使用
done
```

### 3. 重啟後端服務

```bash
# 重啟後端 API 服務
docker-compose restart backend
```

## 測試建議

### 1. 測試新的 `/all` 端點

```bash
# 測試不同時間段
curl "http://localhost:8000/api/v1/hotspots/all?period_days=365"
curl "http://localhost:8000/api/v1/hotspots/all?period_days=90"
curl "http://localhost:8000/api/v1/hotspots/all?period_days=30"

# 測試嚴重程度篩選
curl "http://localhost:8000/api/v1/hotspots/all?severity_levels=A1,A2"
```

### 2. 測試熱點詳細資訊

```bash
# 取得第一個熱點 ID
HOTSPOT_ID=$(curl -s "http://localhost:8000/api/v1/hotspots/all?limit=1" | jq -r '.data[0].id')

# 測試基本資訊
curl "http://localhost:8000/api/v1/hotspots/$HOTSPOT_ID"

# 測試包含事故列表
curl "http://localhost:8000/api/v1/hotspots/$HOTSPOT_ID?include_accidents=true"
```

### 3. 驗證資料完整性

```bash
# 檢查每個時間段的熱點數量
for days in 365 180 90 30; do
  count=$(curl -s "http://localhost:8000/api/v1/hotspots/all?period_days=$days" | jq '.meta.total_count')
  echo "$days 天: $count 個熱點"
done
```

## Frontend 更新建議

如果前端有使用被移除的端點，需要更新為新的 `/all` 端點：

```typescript
// 舊的（需要更新）
const hotspots = await fetchNearbyHotspots(lat, lng, distance);
const hotspots = await fetchHotspotsInBounds(sw_lat, sw_lng, ne_lat, ne_lng);

// 新的
const hotspots = await fetchAllHotspots(periodDays, severityLevels);
```

## 常見問題

### Q: 為什麼移除 nearby 和 in-bounds 端點？

A: 簡化 API 設計，統一使用 `/all` 端點。前端可以在取得所有熱點後，自行根據地圖範圍或用戶位置進行篩選。

### Q: 如何定期更新不同時間段的熱點？

A: 建議設定 cron job 定期執行：

```bash
# 每天凌晨 2 點更新所有時間段的熱點
0 2 * * * cd /path/to/project && for days in 365 180 90 30; do uv run python data/generate_hotspots.py --database-url "$DATABASE_URL" --period-days $days --epsilon-meters 200 --min-accidents 5; done
```

### Q: 舊資料會被自動遷移嗎？

A: migration 會自動為現有資料設定 `analysis_period_days = 365`，但建議重新生成熱點資料以確保準確性。

