# 實作計劃：智慧道路守護系統

**分支**: `001-road-safety-system` | **日期**: 2025-11-02 | **規格**: [spec.md](spec.md)

## 摘要

智慧道路守護系統透過分析台灣政府公開的A1、A2、A3交通事故資料，識別事故熱點，並在用戶接近危險區域時提供即時警示（音效/震動/視覺提示）。系統包含後端資料擷取與熱點分析服務、前端地圖視覺化與即時警示介面。

**核心功能**：
- 每週自動擷取政府公開事故資料（A1、A2、A3）
- 每日執行地理聚類分析識別過去一年內的事故熱點
- 前端地圖顯示熱點位置與範圍
- 根據用戶GPS位置即時觸發警示（可自訂距離、事故等級、時間範圍、警示方式）

## 技術背景

**後端技術棧**：
- **語言/版本**: Python 3.12
- **框架**: FastAPI
- **套件管理**: uv
- **資料庫**: PostgreSQL 15 + PostGIS (地理空間擴充)
- **ORM**: SQLAlchemy 2.x
- **資料庫遷移**: Alembic
- **測試**: pytest
- **部署**: Docker + GCP
- **地理編碼**: Google Maps Geocoding API (用於A3資料地址轉換)

**前端技術棧**：

- **框架**: React + Vite
- **UI框架**: Tailwind CSS + Headless UI
- **狀態管理**: Redux Toolkit
- **地圖SDK**: Mapbox GL JS v2.16+
- **HTTP請求**: Axios
- **定位功能**: Geolocation API (瀏覽器原生)
- **圖示套件**: Lucide Icons, Heroicons

**專案類型**: Web應用 (frontend + backend)

**效能目標**：
- API回應時間 p95 < 200ms
- 地圖頁面載入時間 < 2秒
- 警示觸發延遲 < 3秒
- GPS位置更新頻率 ≥ 每5秒
- 時間範圍篩選回應 < 1秒

**規模/範圍**：
- 預估年度事故資料：~50萬筆 (A1+A2+A3)
- 熱點數量：~5,000-10,000個（視聚類參數而定）
- 預估用戶數：初期 < 1,000人
- 地圖覆蓋範圍：台灣全島

**約束條件**：
- 政府資料API可用性依賴外部服務
- A3資料無經緯度（需透過地理編碼轉換）
- 前端僅支援App在前景執行時的GPS監控
- 用戶設定儲存於本地（無需帳號系統）

## Constitution 檢查

*閘門：必須在Phase 0研究前通過，並在Phase 1設計後重新檢查*

### I. Code Quality ✅

- **可讀性優先**: 使用有意義的命名與清晰結構
- **SOLID原則**: 資料模型、服務層、API層分離
- **型別安全**: Python使用type hints、TypeScript強型別
- **錯誤處理**: 明確的錯誤訊息與例外處理

**合規狀態**: 通過

### II. Testing Discipline ✅

- **TDD強制**: 所有新功能先寫測試
- **測試要求**:
  - Contract Tests: API端點契約測試
  - Integration Tests: 資料擷取流程、熱點分析、地圖互動
  - Unit Tests: 地理計算、資料轉換、篩選邏輯
  - 覆蓋率 ≥ 80%

**合規狀態**: 通過

### III. User Experience Consistency ✅

- **即時回饋**: 警示觸發、地圖載入、設定變更都有明確回饋
- **錯誤訊息**: 友善的中文錯誤提示（如「GPS訊號弱」）
- **載入狀態**: 地圖載入、資料更新顯示進度
- **無障礙**: 鍵盤導航、語意化HTML、適當對比
- **響應式設計**: 支援手機、平板、桌機

**合規狀態**: 通過

### IV. Performance Standards ⚠️

- **回應時間**: API < 200ms ✅
- **頁面載入**: 地圖 < 2s ✅
- **API延遲**: 警示查詢 p95 < 200ms ✅
- **資料庫查詢**: 使用PostGIS空間索引避免N+1 ✅
- **Bundle Size**: 需控制Mapbox SDK與React打包大小 ⚠️

**潛在風險**: Mapbox SDK本身較大（~500KB），需考慮code splitting與lazy loading

**合規狀態**: 通過（需在實作時監控bundle size）

### V. Documentation Language ✅

- **規格文件**: spec.md 使用繁體中文 ✅
- **計劃文件**: plan.md、research.md、data-model.md 使用繁體中文 ✅
- **任務文件**: tasks.md 使用繁體中文 ✅
- **使用者文件**: quickstart.md 使用繁體中文 ✅
- **程式碼註解**: 公開API使用繁體中文文件字串 ✅

**合規狀態**: 通過

## 專案結構

### 文件（此功能）

```text
specs/001-road-safety-system/
├── spec.md              # 功能規格
├── plan.md              # 本檔案（實作計劃）
├── research.md          # Phase 0輸出（研究決策）
├── data-model.md        # Phase 1輸出（資料模型）
├── quickstart.md        # Phase 1輸出（快速開始指南）
├── contracts/           # Phase 1輸出（API契約）
│   └── openapi.yaml
└── tasks.md             # Phase 2輸出（由 /speckit.tasks 產生）
```

### 原始碼（repository root）

```text
backend/
├── src/
│   ├── api/                    # FastAPI路由與端點
│   │   ├── __init__.py
│   │   ├── accidents.py        # 事故資料API
│   │   └── hotspots.py         # 熱點查詢API
│   ├── models/                 # SQLAlchemy模型
│   │   ├── __init__.py
│   │   ├── accident.py         # 事故記錄模型（A1/A2/A3）
│   │   └── hotspot.py          # 熱點模型
│   ├── services/               # 業務邏輯層
│   │   ├── __init__.py
│   │   ├── data_ingestion.py  # 資料擷取服務
│   │   ├── geocoding.py        # 地理編碼服務（A3轉換）
│   │   └── hotspot_analysis.py # 熱點分析服務（DBSCAN/HDBSCAN）
│   ├── db/                     # 資料庫配置
│   │   ├── __init__.py
│   │   ├── session.py          # 資料庫連線設定
│   │   └── migrations/         # Alembic遷移
│   │       ├── env.py
│   │       └── versions/
│   ├── core/                   # 核心設定
│   │   ├── __init__.py
│   │   └── config.py           # 環境變數與設定
│   └── main.py                 # FastAPI應用程式進入點
├── tests/
│   ├── contract/               # API契約測試
│   ├── integration/            # 整合測試
│   └── unit/                   # 單元測試
├── Dockerfile
├── pyproject.toml              # uv專案配置
└── .env.example

frontend/
├── src/
│   ├── components/             # React元件
│   │   ├── Map/                # 地圖元件
│   │   │   ├── MapView.tsx
│   │   │   ├── HotspotLayer.tsx
│   │   │   └── UserLocation.tsx
│   │   ├── Settings/           # 設定元件
│   │   │   ├── DistanceSelector.tsx
│   │   │   ├── AccidentLevelFilter.tsx
│   │   │   ├── TimeRangeFilter.tsx
│   │   │   └── AlertModeSelector.tsx
│   │   └── Alert/              # 警示元件
│   │       ├── AlertOverlay.tsx
│   │       └── AlertIcon.tsx
│   ├── pages/                  # 頁面元件
│   │   ├── MapPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/               # 服務層
│   │   ├── api.ts              # Axios API客戶端
│   │   ├── geolocation.ts      # GPS定位服務
│   │   └── alerts.ts           # 警示邏輯服務
│   ├── store/                  # Redux狀態管理
│   │   ├── index.ts
│   │   ├── hotspotsSlice.ts
│   │   ├── settingsSlice.ts
│   │   └── locationSlice.ts
│   ├── types/                  # TypeScript型別定義
│   │   ├── accident.ts
│   │   ├── hotspot.ts
│   │   └── settings.ts
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── integration/
│   └── unit/
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── .env.example

.github/
└── workflows/
    ├── backend-ci.yml          # 後端CI/CD
    └── frontend-ci.yml         # 前端CI/CD

docker-compose.yml              # 本地開發環境
README.md                       # 專案說明（繁體中文）
```

**結構決策**：選擇 **Option 2: Web應用** 結構，因為系統包含獨立的後端API服務（資料擷取與熱點分析）與前端互動介面（地圖與警示）。前後端分離便於獨立部署與擴展。

## 複雜度追蹤

> 本功能無Constitution違規，此區段留空。

---

## Phase 0: 大綱與研究

**目標**: 解決所有技術不確定性，產生 `research.md`

### 待研究項目

基於Technical Context，以下為需要研究的技術決策：

1. **地理聚類演算法選擇**
   - DBSCAN vs HDBSCAN for 事故熱點識別
   - 參數調校策略（epsilon、min_samples）
   - Python函式庫選擇：scikit-learn vs hdbscan

2. **PostGIS空間查詢優化**
   - 空間索引類型（GIST vs BRIN）
   - 距離查詢最佳實踐（ST_DWithin vs ST_Distance）
   - 經緯度四捨五入策略對查詢效能的影響

3. **Google Maps Geocoding API整合**
   - API配額管理（每月免費額度 vs 付費方案）
   - 批次處理策略（避免rate limiting）
   - 錯誤處理與重試機制

4. **Mapbox GL JS最佳實踐**
   - 熱點視覺化圖層設計（Heatmap vs Cluster vs Circle）
   - 效能優化（tile caching、vector tiles）
   - 離線地圖支援可行性

5. **即時GPS監控與警示觸發**
   - Geolocation API輪詢頻率 vs watchPosition
   - 前端位置比對演算法（避免過度API請求）
   - 震動API (Vibration API) 瀏覽器支援度

6. **Docker多階段建置**
   - Python 3.12 + uv 的Docker最佳實踐
   - Vite前端建置優化
   - 多服務docker-compose設定（backend + frontend + postgres + redis?）

### 研究輸出

將產生 `research.md`，內容包含：
- 每個技術選擇的決策
- 理由說明
- 考慮過的替代方案
- 參考資料連結

---

## Phase 1: 設計與契約

**前置條件**: `research.md` 完成

### 產出

1. **data-model.md**: 資料模型設計
   - Accident (事故記錄) 模型
   - Hotspot (熱點) 模型
   - 關聯與索引策略

2. **contracts/openapi.yaml**: API契約
   - GET `/api/v1/hotspots` - 查詢熱點（支援地理範圍、時間範圍、事故等級篩選）
   - GET `/api/v1/accidents` - 查詢事故記錄（管理用途）
   - POST `/api/v1/admin/ingest` - 手動觸發資料擷取（管理端點）

3. **quickstart.md**: 快速開始指南
   - 環境需求
   - 本地開發設定
   - Docker啟動指令
   - API測試範例

4. **更新agent context**: 執行 `.specify/scripts/bash/update-agent-context.sh claude`

---

## 下一步

執行完成後，使用 `/speckit.tasks` 產生 `tasks.md` 進行實作。
