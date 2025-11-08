# 快速開始指南：背景警示與路線規劃

**功能**: 背景警示與路線規劃
**版本**: 1.0
**建立日期**: 2025-11-08
**相關文件**: [spec.md](./spec.md) | [plan.md](./plan.md) | [research.md](./research.md) | [data-model.md](./data-model.md)

---

## 目錄

1. [功能概覽](#功能概覽)
2. [環境需求](#環境需求)
3. [初始設定](#初始設定)
4. [開發流程](#開發流程)
5. [快速開始範例](#快速開始範例)
6. [關鍵技術點](#關鍵技術點)
7. [測試指引](#測試指引)
8. [常見問題](#常見問題)

---

## 功能概覽

本功能為智慧道路守護系統新增背景警示和路線規劃能力，包含 4 個 User Stories（依優先順序排列）：

### US1 - 背景安全監控 (P1)

機車騎士小明在騎車通勤時，將手機放在口袋中並關閉螢幕以節省電量。當他接近一個事故熱點區域時，即使螢幕關閉，手機仍會根據他的設定（震動或音效）發出警示，提醒他注意安全。

**核心功能**:
- 前景定位追蹤（使用 `watchPosition()`，Web 平台限制）
- 多模態警示系統（震動、音效、視覺）
- 背景監控狀態管理

**技術限制**: Web 平台無法實現真正的背景定位追蹤，需明確告知使用者保持瀏覽器開啟。

---

### US2 - 事故數量篩選 (P2)

使用者小華希望只關注事故數量較多的危險路段，不想被單一事故的熱點干擾。她在設定中將數量篩選調整為「3」，這樣系統只會顯示和警示總事故數超過 3 筆的熱點。

**核心功能**:
- Range Slider 介面（1-10）
- 即時篩選地圖顯示的熱點
- 根據閾值決定是否觸發警示

---

### US3 - 路線安全評估 (P3)

使用者小李計劃騎車前往一個新地點，他在應用程式中輸入目的地地址。系統規劃出一條路線並顯示在地圖上。路線完成後，畫面下方出現一個資訊卡，顯示「此路線經過路段共有 12 筆車禍，其中 A1 有 2 筆，A2 有 5 筆，A3 有 5 筆。建議考慮使用大眾交通工具。」

**核心功能**:
- 整合 Mapbox Directions API 規劃路線
- PostGIS 查詢路線 200 公尺範圍內的事故熱點
- 計算路線安全評分（A1×3 + A2×2 + A3×1）
- 根據風險評分顯示建議（評分 > 15 時建議搭乘大眾交通）

---

### US4 - 彈性路線調整 (P3)

使用者小陳在規劃路線後，發現預設起點不是自己想要的出發地。他點擊上方的「你的位置」搜尋框，改成另一個地址作為起點。系統重新規劃路線並更新事故統計資訊。

**核心功能**:
- 第一次搜尋後顯示雙搜尋框（起點 + 目的地）
- 支援修改起點或目的地
- 即時重新規劃路線並更新安全統計

---

## 環境需求

### Backend

- **Python**: 3.12+
- **資料庫**: PostgreSQL 15+ with PostGIS 3.4+
- **框架**: FastAPI
- **ORM**: SQLAlchemy 2.0+ with GeoAlchemy2
- **測試**: pytest, pytest-asyncio, pytest-cov

### Frontend

- **Node.js**: 18+
- **語言**: TypeScript 5.9+
- **框架**: React 19
- **狀態管理**: Redux Toolkit
- **地圖**: Mapbox GL 3.16+
- **測試**: Vitest, @testing-library/react

### 外部 API

- **Mapbox API Key**: 用於路線規劃和地址搜尋
  - Directions API: 路線規劃
  - Geocoding API: 地址搜尋與反向地理編碼
  - 免費額度: 100,000 次/月
  - 超額計費: $2/1000 次

---

## 初始設定

### 1. 資料庫設定

#### 啟用 PostGIS 擴展

```sql
-- 連接到資料庫
psql -U postgres -d roadguard

-- 啟用 PostGIS 和 pg_trgm 擴展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### 執行資料庫遷移

建立所有必要的資料表和索引：

```bash
# 切換到 backend 目錄
cd backend

# 執行遷移腳本
# 依序建立：routes, route_safety_summaries, background_alert_settings,
# search_history, alert_logs, user_preferences

# 參考 data-model.md 中的 SQL 定義
```

#### 驗證空間索引

```sql
-- 檢查 hotspots 資料表的 GIST 索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'hotspots' AND indexdef LIKE '%GIST%';

-- 如果不存在，建立索引
CREATE INDEX idx_hotspots_geom ON hotspots USING GIST(geom);

-- 可選：執行 CLUSTER 提升查詢效能
CLUSTER hotspots USING idx_hotspots_geom;
```

### 2. Mapbox API Key 設定

#### 取得 API Key

1. 前往 [Mapbox 官網](https://www.mapbox.com/) 註冊帳號
2. 在 Dashboard 建立新的 Access Token
3. 啟用以下權限：
   - Directions API
   - Geocoding API
   - Maps API

#### 環境變數設定

**Backend** (`backend/.env`):

```bash
# 資料庫連線
DATABASE_URL=postgresql://user:password@localhost:5432/roadguard

# Mapbox API Key
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_access_token_here

# API 設定
API_HOST=0.0.0.0
API_PORT=8000
```

**Frontend** (`frontend/.env`):

```bash
# Mapbox API Key
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_access_token_here

# Backend API URL
VITE_API_BASE_URL=http://localhost:8000/v1
```

### 3. 安裝相依套件

#### Backend

```bash
cd backend

# 建立虛擬環境
python3.12 -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安裝套件
pip install -r requirements.txt

# 驗證安裝
python -c "import geoalchemy2; print('GeoAlchemy2 installed')"
```

#### Frontend

```bash
cd frontend

# 安裝套件
npm install

# 驗證安裝
npm list @mapbox/mapbox-gl-directions
```

---

## 開發流程

本專案遵循 **Test-Driven Development (TDD)** 開發流程，依據 Constitution II 的要求。

### 階段劃分

依據 User Story 優先順序，按階段實作：

```
Phase 1: US1 (P1) - 背景安全監控
  ↓
Phase 2: US2 (P2) - 事故數量篩選
  ↓
Phase 3: US3 (P3) - 路線安全評估
  ↓
Phase 4: US4 (P3) - 彈性路線調整
```

### TDD 工作流程（Red-Green-Refactor）

每個功能的開發遵循以下步驟：

```
1. Red (寫測試，測試失敗)
   ├── 撰寫 Contract Tests（外部 API 整合）
   ├── 撰寫 Integration Tests（端到端工作流程）
   └── 撰寫 Unit Tests（業務邏輯）

2. Green (實作程式碼，測試通過)
   ├── 實作最小可行的程式碼
   └── 確保所有測試通過

3. Refactor (重構，保持測試通過)
   ├── 優化程式碼結構
   ├── 移除重複程式碼
   └── 確保測試持續通過
```

### 檔案結構參考

```text
backend/
├── src/
│   ├── models/
│   │   ├── user_settings.py         # BackgroundAlertSettings
│   │   └── route.py                 # Route, RouteSafetySummary
│   ├── services/
│   │   ├── background_monitor.py    # 背景監控服務
│   │   ├── geospatial.py            # 地理空間計算
│   │   ├── route_planner.py         # 路線規劃服務
│   │   └── safety_calculator.py     # 安全評估服務
│   └── api/
│       ├── settings.py              # 設定 API endpoints
│       ├── routes.py                # 路線規劃 API endpoints
│       └── monitoring.py            # 背景監控 API endpoints
└── tests/
    ├── contract/
    │   └── test_mapbox_api.py       # Mapbox API contract tests
    ├── integration/
    │   ├── test_background_monitoring_workflow.py
    │   └── test_route_planning_workflow.py
    └── unit/
        ├── test_geospatial.py       # 地理空間計算單元測試
        ├── test_safety_calculator.py
        └── test_filter_logic.py

frontend/
├── src/
│   ├── components/
│   │   ├── map/
│   │   │   ├── RouteLayer.tsx       # 路線圖層
│   │   │   └── SearchBox.tsx        # 地址搜尋框
│   │   ├── settings/
│   │   │   ├── AlertSettings.tsx    # 警示方式設定
│   │   │   └── ThresholdSlider.tsx  # 數量篩選滑桿
│   │   └── route/
│   │       └── RouteSafetySummary.tsx  # 路線安全統計 drawer
│   ├── services/
│   │   ├── backgroundMonitor.ts     # 背景監控 service
│   │   ├── geolocation.ts           # 位置追蹤 service
│   │   ├── notification.ts          # 警示通知 service
│   │   └── routePlanner.ts          # 路線規劃 API client
│   └── store/
│       └── slices/
│           ├── settingsSlice.ts     # 使用者設定 state
│           ├── routeSlice.ts        # 路線規劃 state
│           └── monitoringSlice.ts   # 背景監控狀態
└── tests/
    ├── contract/
    │   └── routePlanner.test.ts     # Route planner API contract tests
    ├── integration/
    │   ├── backgroundMonitoring.test.tsx
    │   └── routePlanning.test.tsx
    └── unit/
        ├── geolocation.test.ts
        ├── notification.test.ts
        └── safetyCalculator.test.ts
```

---

## 快速開始範例

### Backend: 路線規劃 API 實作範例

#### 1. 撰寫 Contract Test (Red)

```python
# tests/contract/test_mapbox_api.py
import pytest
import httpx
from src.config import settings

@pytest.mark.asyncio
async def test_mapbox_directions_api_contract():
    """驗證 Mapbox Directions API 回應格式"""
    url = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic/121.5678,25.0408;121.5154,25.0448"
    params = {
        "access_token": settings.MAPBOX_ACCESS_TOKEN,
        "geometries": "geojson",
        "overview": "full",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)

    assert response.status_code == 200
    data = response.json()

    # 驗證回應結構
    assert "routes" in data
    assert len(data["routes"]) > 0

    route = data["routes"][0]
    assert "geometry" in route
    assert route["geometry"]["type"] == "LineString"
    assert "distance" in route
    assert "duration" in route
```

#### 2. 實作路線規劃服務 (Green)

```python
# src/services/route_planner.py
from typing import List, Tuple
import httpx
from src.config import settings

class RoutePlanner:
    def __init__(self):
        self.base_url = "https://api.mapbox.com/directions/v5/mapbox"
        self.access_token = settings.MAPBOX_ACCESS_TOKEN

    async def plan_route(
        self,
        waypoints: List[Tuple[float, float]],  # [(lng, lat), ...]
        profile: str = "driving-traffic"
    ) -> dict:
        """規劃路線並回傳 Mapbox API 回應"""
        coordinates = ";".join([f"{lng},{lat}" for lng, lat in waypoints])
        url = f"{self.base_url}/{profile}/{coordinates}"

        params = {
            "access_token": self.access_token,
            "geometries": "geojson",
            "overview": "full",
            "steps": True,
            "annotations": "duration,distance"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()

        return response.json()["routes"][0]
```

#### 3. 實作 API Endpoint (Green)

```python
# src/api/routes.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.route_planner import RoutePlanner
from src.services.safety_calculator import SafetyCalculator
from src.database import get_db
from src.models.route import Route, RouteSafetySummary
from pydantic import BaseModel

router = APIRouter(prefix="/api/routes", tags=["Routes"])

class PlanRouteRequest(BaseModel):
    originLat: float
    originLng: float
    originAddress: str
    destinationLat: float
    destinationLng: float
    destinationAddress: str
    profile: str = "driving-traffic"

@router.post("/plan")
async def plan_route(
    request: PlanRouteRequest,
    db: AsyncSession = Depends(get_db)
):
    """規劃路線並計算安全統計"""
    try:
        # 1. 呼叫 Mapbox API 規劃路線
        planner = RoutePlanner()
        route_data = await planner.plan_route(
            waypoints=[
                (request.originLng, request.originLat),
                (request.destinationLng, request.destinationLat)
            ],
            profile=request.profile
        )

        # 2. 儲存路線到資料庫
        route = Route(
            user_id=1,  # TODO: 從 auth token 取得
            origin_address=request.originAddress,
            origin_lat=request.originLat,
            origin_lng=request.originLng,
            destination_address=request.destinationAddress,
            destination_lat=request.destinationLat,
            destination_lng=request.destinationLng,
            route_geom=route_data["geometry"],
            distance_meters=route_data["distance"],
            duration_seconds=route_data["duration"],
            profile=request.profile,
            is_active=True
        )
        db.add(route)
        await db.flush()

        # 3. 查詢路線經過的事故熱點（PostGIS ST_DWithin）
        calculator = SafetyCalculator(db)
        hotspots = await calculator.get_hotspots_along_route(
            route_geom=route.route_geom,
            distance_meters=200
        )

        # 4. 計算安全統計
        safety_summary = await calculator.calculate_safety_summary(
            route_id=route.id,
            hotspots=hotspots
        )

        await db.commit()

        return {
            "route": route,
            "safetySummary": safety_summary,
            "hotspots": hotspots
        }

    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail="路線規劃服務暫時無法使用")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Frontend: 路線規劃元件範例

#### 1. 撰寫 Unit Test (Red)

```typescript
// tests/unit/routePlanner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { planRoute } from '@/services/routePlanner';

describe('routePlanner', () => {
  it('should plan route and return route data', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        route: {
          id: 1,
          routeGeom: {
            type: 'LineString',
            coordinates: [[121.5678, 25.0408], [121.5154, 25.0448]]
          },
          distanceMeters: 5234.5,
          durationSeconds: 892.3
        },
        safetySummary: {
          totalAccidents: 12,
          a1Count: 2,
          a2Count: 5,
          a3Count: 5,
          riskScore: 21.0,
          suggestPublicTransport: true
        }
      })
    });

    const result = await planRoute({
      originLat: 25.0408,
      originLng: 121.5678,
      originAddress: '台北市信義區市府路1號',
      destinationLat: 25.0448,
      destinationLng: 121.5154,
      destinationAddress: '台北市中正區重慶南路一段122號'
    });

    expect(result.route.distanceMeters).toBe(5234.5);
    expect(result.safetySummary.suggestPublicTransport).toBe(true);
  });
});
```

#### 2. 實作路線規劃 Service (Green)

```typescript
// src/services/routePlanner.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface PlanRouteRequest {
  originLat: number;
  originLng: number;
  originAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  profile?: 'driving-traffic' | 'driving' | 'walking' | 'cycling';
}

interface RouteResponse {
  route: Route;
  safetySummary: RouteSafetySummary;
  hotspots: HotspotWithDistance[];
}

export async function planRoute(request: PlanRouteRequest): Promise<RouteResponse> {
  const response = await axios.post(`${API_BASE_URL}/api/routes/plan`, request);
  return response.data;
}
```

#### 3. 實作 React 元件 (Green)

```typescript
// src/components/route/RoutePlanner.tsx
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { planRoute } from '@/services/routePlanner';
import { setRoute, setSafetySummary } from '@/store/slices/routeSlice';
import SearchBox from '@/components/map/SearchBox';
import RouteSafetySummary from '@/components/route/RouteSafetySummary';

export default function RoutePlanner() {
  const dispatch = useDispatch();
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [isPlanning, setIsPlanning] = useState(false);
  const route = useSelector((state) => state.route.current);
  const safetySummary = useSelector((state) => state.route.safetySummary);

  const handlePlanRoute = async () => {
    if (!origin || !destination) return;

    setIsPlanning(true);
    try {
      const result = await planRoute({
        originAddress: origin,
        originLat: 25.0408, // TODO: 從 geocoding 取得
        originLng: 121.5678,
        destinationAddress: destination,
        destinationLat: 25.0448,
        destinationLng: 121.5154
      });

      dispatch(setRoute(result.route));
      dispatch(setSafetySummary(result.safetySummary));
    } catch (error) {
      console.error('路線規劃失敗', error);
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="route-planner">
      <SearchBox
        placeholder="搜尋目的地"
        value={destination}
        onChange={setDestination}
      />

      <button
        onClick={handlePlanRoute}
        disabled={isPlanning || !destination}
      >
        {isPlanning ? '規劃中...' : '開始規劃'}
      </button>

      {safetySummary && (
        <RouteSafetySummary summary={safetySummary} />
      )}
    </div>
  );
}
```

---

### 測試範例

#### Backend Integration Test

```python
# tests/integration/test_route_planning_workflow.py
import pytest
from httpx import AsyncClient
from src.main import app

@pytest.mark.asyncio
async def test_route_planning_workflow(async_client: AsyncClient):
    """測試完整的路線規劃工作流程"""

    # 1. 規劃路線
    plan_request = {
        "originLat": 25.0408,
        "originLng": 121.5678,
        "originAddress": "台北市信義區市府路1號",
        "destinationLat": 25.0448,
        "destinationLng": 121.5154,
        "destinationAddress": "台北市中正區重慶南路一段122號",
        "profile": "driving-traffic"
    }

    response = await async_client.post("/api/routes/plan", json=plan_request)
    assert response.status_code == 201

    data = response.json()
    route_id = data["route"]["id"]

    # 2. 驗證路線資料
    assert data["route"]["distanceMeters"] > 0
    assert data["route"]["durationSeconds"] > 0
    assert data["route"]["routeGeom"]["type"] == "LineString"

    # 3. 驗證安全統計
    assert "safetySummary" in data
    summary = data["safetySummary"]
    assert summary["totalAccidents"] >= 0
    assert summary["totalAccidents"] == (
        summary["a1Count"] + summary["a2Count"] + summary["a3Count"]
    )

    # 4. 取得路線安全統計
    response = await async_client.get(f"/api/routes/{route_id}/safety")
    assert response.status_code == 200

    safety_data = response.json()
    assert "safetySummary" in safety_data
    assert "hotspots" in safety_data
```

#### Frontend Unit Test

```typescript
// tests/unit/safetyCalculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateRiskScore, shouldSuggestPublicTransport } from '@/utils/safetyCalculator';

describe('safetyCalculator', () => {
  it('should calculate risk score correctly', () => {
    const score = calculateRiskScore({
      a1Count: 2,
      a2Count: 5,
      a3Count: 5
    });

    // A1×3 + A2×2 + A3×1 = 2×3 + 5×2 + 5×1 = 21
    expect(score).toBe(21);
  });

  it('should suggest public transport when risk score > 15', () => {
    expect(shouldSuggestPublicTransport(16)).toBe(true);
    expect(shouldSuggestPublicTransport(15)).toBe(false);
    expect(shouldSuggestPublicTransport(10)).toBe(false);
  });
});
```

---

## 關鍵技術點

### 1. PostGIS 空間查詢 (ST_DWithin)

#### 查詢路線 200 公尺範圍內的事故熱點

```sql
-- 使用 ST_DWithin 進行高效能空間查詢
SELECT
  h.id,
  h.location_name,
  h.severity,
  h.total_count,
  ST_Distance(h.geom::geography, $1::geography) as distance_meters
FROM hotspots h
WHERE ST_DWithin(
  h.geom::geography,
  $1::geography,  -- 路線幾何（LineString）
  200             -- 200 公尺
)
AND h.total_count >= $2  -- 根據使用者設定的數量篩選
ORDER BY distance_meters ASC;
```

#### 確保空間索引存在

```sql
-- 建立 GIST 空間索引（如果尚未建立）
CREATE INDEX IF NOT EXISTS idx_hotspots_geom
ON hotspots USING GIST(geom);

-- 定期執行 CLUSTER 最佳化查詢效能
CLUSTER hotspots USING idx_hotspots_geom;
```

### 2. Geolocation API 使用

#### 啟動位置追蹤

```javascript
// src/services/geolocation.ts
let watchId: number | null = null;

export function startWatchingPosition(
  onPositionUpdate: (position: GeolocationPosition) => void,
  onError: (error: GeolocationPositionError) => void
) {
  if (!navigator.geolocation) {
    throw new Error('Geolocation API 不支援');
  }

  watchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    onError,
    {
      enableHighAccuracy: true,  // 高精度模式
      timeout: 10000,            // 10 秒超時
      maximumAge: 5000           // 最多使用 5 秒前的快取位置
    }
  );

  return watchId;
}

export function stopWatchingPosition() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}
```

### 3. Vibration API 和 Audio API

#### 多模態警示系統

```javascript
// src/services/notification.ts

// 播放警示音效（Web Audio API）
export function playAlertSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 音
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.01,
    audioContext.currentTime + 0.5
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

// 觸發震動（僅 Android，漸進增強）
export function vibrateAlert() {
  if ('vibrate' in navigator) {
    // 200ms 震動, 100ms 暫停, 200ms 震動
    navigator.vibrate([200, 100, 200]);
  }
}

// 組合警示（根據使用者設定）
export function triggerAlert(alertMode: AlertMode) {
  switch (alertMode) {
    case 'vibration_only':
      vibrateAlert();
      break;
    case 'sound_only':
      playAlertSound();
      break;
    case 'both':
      vibrateAlert();
      playAlertSound();
      break;
    case 'disabled':
      // 不觸發警示
      break;
  }
}
```

### 4. Mapbox Directions API 整合

#### 基本路線規劃

```javascript
// src/services/mapboxClient.ts
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export async function getDirections(waypoints: [number, number][]) {
  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const profile = 'driving-traffic';
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`;

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    annotations: 'duration,distance'
  });

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) {
    throw new Error('Mapbox API 請求失敗');
  }

  const data = await response.json();
  return data.routes[0];
}
```

#### 路線快取（使用 IndexedDB）

```javascript
// src/services/routeCache.ts
import { openDB } from 'idb';

const DB_NAME = 'roadguard-cache';
const STORE_NAME = 'routes';
const CACHE_DURATION = 3600000; // 1 小時

async function getCachedRoute(waypoints: [number, number][]) {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    }
  });

  const key = JSON.stringify(waypoints);
  const cached = await db.get(STORE_NAME, key);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.route;
  }

  return null;
}

async function setCachedRoute(waypoints: [number, number][], route: any) {
  const db = await openDB(DB_NAME, 1);
  const key = JSON.stringify(waypoints);

  await db.put(STORE_NAME, {
    route,
    timestamp: Date.now()
  }, key);
}
```

---

## 測試指引

### 執行測試

#### Backend

```bash
cd backend

# 執行所有測試
pytest

# 執行特定測試類型
pytest tests/contract/      # Contract tests
pytest tests/integration/   # Integration tests
pytest tests/unit/          # Unit tests

# 產生覆蓋率報告
pytest --cov=src --cov-report=html

# 覆蓋率報告會產生在 htmlcov/index.html
```

#### Frontend

```bash
cd frontend

# 執行所有測試
npm test

# 執行特定測試檔案
npm test -- routePlanner.test.ts

# 產生覆蓋率報告
npm run test:coverage

# 覆蓋率報告會產生在 coverage/index.html
```

### 覆蓋率要求

根據 Constitution II，測試覆蓋率要求：

- **一般程式碼**: ≥ 80%
- **關鍵路徑** (警示觸發、路線安全計算): 100%

### Contract Test 設定

#### Backend: Mapbox API Contract Test

```python
# tests/contract/test_mapbox_api.py
import pytest
import httpx
from src.config import settings

@pytest.mark.contract
@pytest.mark.asyncio
async def test_mapbox_directions_api_returns_valid_route():
    """確保 Mapbox Directions API 回傳格式符合預期"""
    url = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic/121.5678,25.0408;121.5154,25.0448"
    params = {
        "access_token": settings.MAPBOX_ACCESS_TOKEN,
        "geometries": "geojson",
        "overview": "full"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)

    assert response.status_code == 200
    data = response.json()

    # 驗證必要欄位存在
    assert "routes" in data
    assert len(data["routes"]) > 0

    route = data["routes"][0]
    assert "geometry" in route
    assert "distance" in route
    assert "duration" in route

    # 驗證幾何格式
    assert route["geometry"]["type"] == "LineString"
    assert len(route["geometry"]["coordinates"]) > 0
```

#### Frontend: Backend API Contract Test

```typescript
// tests/contract/routePlanner.test.ts
import { describe, it, expect } from 'vitest';
import { planRoute } from '@/services/routePlanner';

describe('Route Planner API Contract', () => {
  it('should return route with required fields', async () => {
    const result = await planRoute({
      originLat: 25.0408,
      originLng: 121.5678,
      originAddress: '台北市信義區市府路1號',
      destinationLat: 25.0448,
      destinationLng: 121.5154,
      destinationAddress: '台北市中正區重慶南路一段122號'
    });

    // 驗證 route 物件
    expect(result.route).toHaveProperty('id');
    expect(result.route).toHaveProperty('routeGeom');
    expect(result.route).toHaveProperty('distanceMeters');
    expect(result.route).toHaveProperty('durationSeconds');

    // 驗證 safetySummary 物件
    expect(result.safetySummary).toHaveProperty('totalAccidents');
    expect(result.safetySummary).toHaveProperty('a1Count');
    expect(result.safetySummary).toHaveProperty('riskScore');
    expect(result.safetySummary).toHaveProperty('suggestPublicTransport');

    // 驗證 hotspots 陣列
    expect(Array.isArray(result.hotspots)).toBe(true);
  });
});
```

---

## 常見問題

### 1. Web 平台的背景追蹤限制

**問題**: Web 應用程式無法在瀏覽器背景時取得定位資訊。

**解決方案**:
- 使用前景定位追蹤（`watchPosition()`）
- 在 UI 明確告知使用者需保持瀏覽器開啟
- 提供「保持螢幕喚醒」選項（Wake Lock API）

```javascript
// 請求保持螢幕喚醒
let wakeLock = null;

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('螢幕保持喚醒');
  } catch (err) {
    console.error('無法保持螢幕喚醒:', err);
  }
}

// 使用者離開頁面時釋放
document.addEventListener('visibilitychange', () => {
  if (wakeLock !== null && document.visibilityState === 'hidden') {
    wakeLock.release();
    wakeLock = null;
  }
});
```

### 2. iOS 不支援震動功能

**問題**: iPhone 不支援 Vibration API。

**解決方案**:
- 採用多模態警示設計（視覺 + 音效 + 震動）
- 震動作為額外功能，不作為唯一警示方式
- 功能偵測後在 UI 顯示可用的警示模式

```javascript
// 偵測震動支援並更新 UI
export function getAvailableAlertModes(): AlertMode[] {
  const modes: AlertMode[] = ['sound_only', 'disabled'];

  if ('vibrate' in navigator) {
    modes.push('vibration_only', 'both');
  }

  return modes;
}
```

### 3. GPS 精確度問題

**問題**: 在隧道、室內或高樓區，GPS 定位可能不準確或中斷。

**解決方案**:
- 使用 `enableHighAccuracy: true` 提高精度
- 設定合理的距離閾值（200m 而非 50m）
- 連續 N 次位置更新都接近危險路段才警示（避免單次誤報）
- 允許使用者手動回報誤報

```javascript
// 防止誤報：連續 3 次位置更新都接近熱點才警示
let consecutiveProximityCount = 0;
const REQUIRED_CONSECUTIVE_COUNT = 3;

function checkProximity(userPosition, hotspot) {
  const distance = calculateDistance(userPosition, hotspot);

  if (distance <= 200) {
    consecutiveProximityCount++;

    if (consecutiveProximityCount >= REQUIRED_CONSECUTIVE_COUNT) {
      triggerAlert();
      consecutiveProximityCount = 0; // 重置計數器
    }
  } else {
    consecutiveProximityCount = 0;
  }
}
```

### 4. Mapbox API 額度超限

**問題**: 超過每月 100,000 次免費額度，產生預期外的費用。

**解決方案**:
- 實作前端快取（IndexedDB），相同路線 1 小時內不重複請求
- 監控 API 使用量（Mapbox Dashboard）
- 設定用量警報（接近 80% 額度時通知）
- 準備遷移計畫（OSRM 自架方案）

```javascript
// 路線快取策略
async function planRouteWithCache(waypoints) {
  // 1. 檢查快取
  const cached = await getCachedRoute(waypoints);
  if (cached) {
    console.log('使用快取路線');
    return cached;
  }

  // 2. 呼叫 API
  const route = await getDirections(waypoints);

  // 3. 儲存到快取
  await setCachedRoute(waypoints, route);

  return route;
}
```

### 5. PostGIS 查詢效能不佳

**問題**: 路線規劃時查詢危險路段超過 1 秒，影響使用者體驗。

**解決方案**:
- 建立 GIST 空間索引（必要）
- 定期執行 `CLUSTER` 最佳化
- 使用 `EXPLAIN ANALYZE` 監控查詢計畫
- 考慮前端分段查詢長路線

```sql
-- 檢查查詢計畫
EXPLAIN ANALYZE
SELECT h.id, h.location_name
FROM hotspots h
WHERE ST_DWithin(
  h.geom::geography,
  ST_GeogFromText('LINESTRING(121.5678 25.0408, 121.5154 25.0448)'),
  200
);

-- 理想的查詢計畫應使用 "Index Scan using idx_hotspots_geom"
-- 如果顯示 "Seq Scan"，表示索引未被使用
```

### 6. HTTPS 需求

**問題**: Geolocation API 僅在 HTTPS 環境下運作。

**解決方案**:
- 本地開發時使用 `localhost`（視為安全來源）
- 生產環境必須使用 HTTPS
- 測試環境也需要 HTTPS 憑證

```bash
# 本地開發使用 HTTPS（使用 mkcert）
mkcert -install
mkcert localhost

# 啟動 HTTPS 開發伺服器
npm run dev -- --https --cert localhost.pem --key localhost-key.pem
```

---

## 下一步

完成本快速開始指南後，你可以：

1. **參考詳細設計文件**:
   - [spec.md](./spec.md) - 功能規格
   - [plan.md](./plan.md) - 實作計畫
   - [data-model.md](./data-model.md) - 資料模型
   - [contracts/openapi.yaml](./contracts/openapi.yaml) - API 規格

2. **執行任務清單**:
   - 使用 `/speckit.tasks` 命令生成任務清單
   - 依據 TDD 工作流程逐步實作

3. **參與程式碼審查**:
   - 遵循 Conventional Commits 規範
   - 確保所有測試通過
   - 覆蓋率達到 ≥ 80%

4. **監控效能指標**:
   - API 回應時間 < 200ms (p95)
   - PostGIS 查詢 < 100ms
   - 路線規劃 < 30 秒

---

**文件版本**: 1.0
**最後更新**: 2025-11-08
**維護者**: Development Team
