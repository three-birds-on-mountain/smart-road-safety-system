# Tasks: 智慧道路守護系統

**Input**: Design documents from `/specs/001-road-safety-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**🎨 Design System**: `/specs/design-system/showcase.html` (必看！所有前端 UI 實作都要參考)

**Tests**: 根據Constitution要求，本專案採用TDD（Test-Driven Development），所有測試任務標記為必要。

**Organization**: 任務按User Story組織，每個Story可獨立實作與測試。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無相依性）
- **[Story]**: 任務所屬的User Story（US1, US2, US3）
- 包含明確的檔案路徑

## Path Conventions

本專案為Web應用（前後端分離）：
- **後端**: `backend/src/`, `backend/tests/`
- **前端**: `frontend/src/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 專案初始化與基礎結構建立

- [ ] T001 根據 plan.md 建立專案目錄結構（backend/, frontend/, docker-compose.yml）
- [ ] T002 初始化後端專案：建立 backend/pyproject.toml 並使用 uv 安裝 FastAPI, SQLAlchemy, PostGIS 相關套件
- [ ] T003 [P] 初始化前端專案：建立 frontend/package.json 並安裝 React, Vite, Tailwind, Redux Toolkit, Mapbox GL JS
- [ ] T004 [P] 配置後端 linting 工具：設定 Black, Ruff 於 backend/pyproject.toml
- [ ] T005 [P] 配置前端 linting 工具：設定 ESLint, Prettier 於 frontend/.eslintrc.json 與 frontend/.prettierrc
- [ ] T006 建立 Docker Compose 配置：docker-compose.yml（PostgreSQL + PostGIS + backend + frontend）
- [ ] T007 [P] 建立後端環境變數範本：backend/.env.example（DATABASE_URL, GOOGLE_MAPS_API_KEY）
- [ ] T008 [P] 建立前端環境變數範本：frontend/.env.example（VITE_API_BASE_URL, VITE_MAPBOX_ACCESS_TOKEN）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基礎設施，所有 User Story 必須先完成此階段才能開始

**⚠️ CRITICAL**: 所有 User Story 工作必須等待此階段完成

### 資料庫與ORM設定

- [ ] T009 設定 PostgreSQL + PostGIS 資料庫：建立 backend/src/db/session.py（SQLAlchemy engine, session factory）
- [ ] T010 初始化 Alembic migrations：執行 alembic init backend/src/db/migrations
- [ ] T011 建立基礎 Enum 型別：backend/src/models/__init__.py（SourceType, SeverityLevel）
- [ ] T012 [P] 建立 Accident 模型：backend/src/models/accident.py（完整欄位、索引、Trigger）
- [ ] T013 [P] 建立 Hotspot 模型：backend/src/models/hotspot.py（完整欄位、索引、Trigger）
- [ ] T014 產生初始資料庫 migration：alembic revision --autogenerate -m "Initial schema"
- [ ] T015 測試資料庫遷移：alembic upgrade head（驗證 PostGIS 擴充、索引建立）

### API 框架設定

- [ ] T016 建立 FastAPI 應用程式主檔：backend/src/main.py（app instance, CORS 設定）
- [ ] T017 [P] 建立 API 路由結構：backend/src/api/__init__.py, backend/src/api/accidents.py, backend/src/api/hotspots.py
- [ ] T018 [P] 建立核心設定模組：backend/src/core/config.py（環境變數管理）
- [ ] T019 [P] 建立錯誤處理中介層：backend/src/core/errors.py（統一錯誤格式）
- [ ] T020 [P] 建立日誌設定：backend/src/core/logging.py（結構化日誌）
- [ ] T021 實作健康檢查端點：backend/src/api/health.py（GET /health, 資料庫連線檢查）

### 服務層基礎

- [ ] T022 [P] 建立 Geocoding Service 骨架：backend/src/services/geocoding.py（Google Maps API 整合準備）
- [ ] T023 [P] 建立 Data Ingestion Service 骨架：backend/src/services/data_ingestion.py（A1/A2/A3 擷取準備）
- [ ] T024 [P] 建立 Hotspot Analysis Service 骨架：backend/src/services/hotspot_analysis.py（DBSCAN 聚類準備）

### 前端基礎設定

- [ ] T025 設定 Redux Store：frontend/src/store/index.ts（store 配置與 middleware）
- [ ] T026 [P] 建立 Redux slices 骨架：frontend/src/store/hotspotsSlice.ts, frontend/src/store/settingsSlice.ts, frontend/src/store/locationSlice.ts
- [ ] T027 [P] 建立 API 客戶端：frontend/src/services/api.ts（Axios instance, base URL 設定）
- [ ] T028 [P] 建立型別定義：frontend/src/types/accident.ts, frontend/src/types/hotspot.ts, frontend/src/types/settings.ts
- [ ] T029 配置 Tailwind CSS：frontend/tailwind.config.js（主題色彩、中文字型）
- [ ] T030 建立基礎佈局元件：frontend/src/App.tsx（路由設定）

**Checkpoint**: Foundation ready - User Story 實作現在可以開始並行進行

---

## Phase 3: User Story 1 - 即時危險區域警示 (Priority: P1) 🎯 MVP

**Goal**: 駕駛者在行駛過程中，當接近或進入交通事故熱點區域時，系統根據用戶設定的警示方式（音效、震動或無提醒）與螢幕視覺提示，提醒駕駛者注意行車安全。

**Independent Test**:
1. 模擬GPS座標進入已知的事故熱點區域（例如：台北市信義區某個熱點中心）
2. 驗證系統是否依照設定的警示方式（音效/震動）正確發出警示
3. 驗證視覺提示顯示熱點資訊（事故等級、事故數量）
4. 離開熱點區域後警示停止

### Tests for User Story 1

> **NOTE: 遵循TDD，先寫這些測試，確保它們FAIL，再進行實作**

#### 後端測試

- [ ] T031 [P] [US1] Contract test for GET /api/v1/hotspots/nearby in backend/tests/contract/test_hotspots_nearby.py（驗證 OpenAPI 契約合規性）
- [ ] T032 [P] [US1] Integration test for 熱點查詢流程 in backend/tests/integration/test_hotspot_query_flow.py（資料庫→Service→API完整流程）
- [ ] T033 [P] [US1] Unit test for 距離計算邏輯 in backend/tests/unit/test_distance_calculation.py（ST_DWithin 查詢邏輯）

#### 前端測試

- [ ] T034 [P] [US1] Integration test for GPS定位與警示觸發 in frontend/tests/integration/test_alert_trigger.spec.ts（模擬GPS移動→API請求→警示顯示）
- [ ] T035 [P] [US1] Unit test for AlertService in frontend/tests/unit/test_alert_service.spec.ts（警示邏輯、音效/震動觸發）

### Implementation for User Story 1

#### 後端實作：熱點查詢 API

- [ ] T036 [P] [US1] 實作 GET /api/v1/hotspots/nearby 路由 in backend/src/api/hotspots.py（參數驗證：latitude, longitude, distance, time_range, severity_levels）
- [ ] T037 [US1] 實作 HotspotService.get_nearby() in backend/src/services/hotspot_service.py（PostGIS ST_DWithin 查詢、時間範圍篩選）
- [ ] T038 [US1] 實作距離計算與排序邏輯 in backend/src/services/hotspot_service.py（ST_Distance 計算、severity_score 加權）
- [ ] T039 [US1] 加入錯誤處理：經緯度範圍驗證（21.5-25.5, 119.5-122.5）in backend/src/api/hotspots.py
- [ ] T040 [US1] 加入日誌記錄：查詢參數、回傳筆數 in backend/src/api/hotspots.py

#### 前端實作：GPS 定位與警示系統

- [ ] T041 [P] [US1] 建立 Geolocation Service in frontend/src/services/geolocation.ts（watchPosition API, 錯誤處理）
- [ ] T042 [P] [US1] 建立 Alert Service in frontend/src/services/alerts.ts（音效播放、Vibration API、距離判斷邏輯）
- [ ] T043 [US1] 實作 locationSlice actions in frontend/src/store/locationSlice.ts（updateLocation, setGPSStatus）
- [ ] T044 [US1] 實作 hotspotsSlice actions in frontend/src/store/hotspotsSlice.ts（fetchNearbyHotspots thunk, updateNearbyList）
- [ ] T045 [P] [US1] 建立 AlertOverlay 元件 in frontend/src/components/Alert/AlertOverlay.tsx（視覺警示、熱點資訊顯示）
- [ ] T046 [P] [US1] 建立 AlertIcon 元件 in frontend/src/components/Alert/AlertIcon.tsx（不同嚴重程度的圖示）
- [ ] T047 [US1] 整合 Geolocation 與 Alert 邏輯 in frontend/src/pages/MapPage.tsx（GPS 更新→查詢熱點→觸發警示）
- [ ] T048 [US1] 實作警示間隔控制（最小30秒）in frontend/src/services/alerts.ts（防止連續重複警示）

#### 驗證與除錯

- [ ] T049 [US1] 執行所有 US1 測試，確保通過（backend: pytest tests/ -k US1, frontend: npm test US1）
- [ ] T050 [US1] 手動測試：使用模擬GPS工具驗證警示觸發（參考 quickstart.md 測試範例）

**Checkpoint**: User Story 1 完全可用，可獨立測試與展示（MVP里程碑）

---

## Phase 4: User Story 2 - 客製化警示設定 (Priority: P2)

**Goal**: 用戶可以根據個人需求調整警示設定，包括：提醒距離（100m/500m/1km/3km）、關注的事故等級（A1/A2/A3）、警示方式（音效/震動/不提醒）、以及事故時間範圍篩選（一年內/半年內/三個月內/一個月內）。

**Independent Test**:
1. 調整設定：提醒距離=1km、事故等級=A1、時間範圍=3個月內、警示方式=震動
2. 模擬GPS移動到符合條件的熱點（1km內、有A1事故、3個月內發生）
3. 驗證系統僅震動並顯示視覺警示，不播放聲音
4. 模擬移動到不符合條件的熱點（例如只有A3事故），驗證無警示

### Tests for User Story 2

#### 前端測試

- [ ] T051 [P] [US2] Unit test for DistanceSelector in frontend/tests/unit/components/test_distance_selector.spec.ts（四個距離選項切換）
- [ ] T052 [P] [US2] Unit test for AccidentLevelFilter in frontend/tests/unit/components/test_accident_level_filter.spec.ts（多選邏輯）
- [ ] T053 [P] [US2] Unit test for TimeRangeFilter in frontend/tests/unit/components/test_time_range_filter.spec.ts（四個時間範圍選項）
- [ ] T054 [P] [US2] Unit test for AlertModeSelector in frontend/tests/unit/components/test_alert_mode_selector.spec.ts（音效/震動/不提醒/多選組合）
- [ ] T055 [P] [US2] Integration test for 設定變更立即生效 in frontend/tests/integration/test_settings_flow.spec.ts（修改設定→查詢熱點→篩選結果）

### Implementation for User Story 2

#### 前端實作：設定介面

- [ ] T056 [P] [US2] 建立 DistanceSelector 元件 in frontend/src/components/Settings/DistanceSelector.tsx（100m/500m/1km/3km單選）
- [ ] T057 [P] [US2] 建立 AccidentLevelFilter 元件 in frontend/src/components/Settings/AccidentLevelFilter.tsx（A1/A2/A3複選checkbox）
- [ ] T058 [P] [US2] 建立 TimeRangeFilter 元件 in frontend/src/components/Settings/TimeRangeFilter.tsx（1年/6個月/3個月/1個月單選）
- [ ] T059 [P] [US2] 建立 AlertModeSelector 元件 in frontend/src/components/Settings/AlertModeSelector.tsx（音效/震動/不提醒複選）
- [ ] T060 [US2] 整合設定頁面 in frontend/src/pages/SettingsPage.tsx（佈局、儲存按鈕）
- [ ] T061 [US2] 實作 settingsSlice actions in frontend/src/store/settingsSlice.ts（updateDistance, updateSeverityLevels, updateTimeRange, updateAlertModes）
- [ ] T062 [US2] 實作本地儲存持久化 in frontend/src/store/settingsSlice.ts（localStorage sync, 應用啟動時載入）

#### 前端實作：設定驅動的篩選邏輯

- [ ] T063 [US2] 修改 fetchNearbyHotspots thunk in frontend/src/store/hotspotsSlice.ts（讀取 settingsSlice 狀態，組合 API 查詢參數）
- [ ] T064 [US2] 修改 Alert Service in frontend/src/services/alerts.ts（根據 alertModes 設定觸發音效/震動/僅視覺）
- [ ] T065 [US2] 實作「不提醒」模式的視覺提示 in frontend/src/components/Alert/AlertOverlay.tsx（短暫顯示圖示但不發出聲音/震動）
- [ ] T066 [US2] 實作多重警示方式組合 in frontend/src/services/alerts.ts（同時播放音效+震動）

#### 後端實作：時間範圍篩選支援

- [ ] T067 [US2] 更新 GET /api/v1/hotspots/nearby in backend/src/api/hotspots.py（支援 time_range 參數：1_month, 3_months, 6_months, 1_year）
- [ ] T068 [US2] 實作時間範圍篩選邏輯 in backend/src/services/hotspot_service.py（latest_accident_at >= NOW() - INTERVAL）
- [ ] T069 [US2] 加入事故等級篩選邏輯 in backend/src/services/hotspot_service.py（根據 severity_levels 參數過濾 a1_count, a2_count, a3_count）

#### 驗證與除錯

- [ ] T070 [US2] 執行所有 US2 測試，確保通過
- [ ] T071 [US2] 手動測試：切換不同設定組合，驗證警示行為符合預期

**Checkpoint**: User Stories 1 AND 2 都可獨立運作，設定功能完整

---

## Phase 5: User Story 3 - 地圖視覺化熱點資訊 (Priority: P3)

**Goal**: 用戶可以在地圖上查看所在區域的事故熱點分布，包括熱點位置、範圍、事故數量、事故等級比例等資訊。

**Independent Test**:
1. 開啟地圖頁面，驗證熱點標記正確顯示
2. 點擊熱點標記，驗證彈窗顯示詳細資訊（中心座標、半徑、事故數量、A1/A2/A3比例）
3. 移動地圖或縮放，驗證熱點動態更新

### Tests for User Story 3

#### 後端測試

- [ ] T072 [P] [US3] Contract test for GET /api/v1/hotspots/in-bounds in backend/tests/contract/test_hotspots_in_bounds.py（驗證 OpenAPI 契約）
- [ ] T073 [P] [US3] Contract test for GET /api/v1/hotspots/{hotspot_id} in backend/tests/contract/test_hotspot_detail.py（驗證詳細資訊契約）
- [ ] T074 [P] [US3] Integration test for 地圖邊界查詢 in backend/tests/integration/test_map_bounds_query.py（ST_MakeEnvelope 查詢邏輯）

#### 前端測試

- [ ] T075 [P] [US3] Integration test for 地圖互動 in frontend/tests/integration/test_map_interaction.spec.ts（載入地圖→顯示熱點→點擊標記→彈窗）
- [ ] T076 [P] [US3] Unit test for HotspotLayer in frontend/tests/unit/components/test_hotspot_layer.spec.ts（標記渲染、顏色映射）

### Implementation for User Story 3

#### 後端實作：地圖查詢 API

- [ ] T077 [P] [US3] 實作 GET /api/v1/hotspots/in-bounds 路由 in backend/src/api/hotspots.py（參數：sw_lat, sw_lng, ne_lat, ne_lng, time_range, severity_levels, limit）
- [ ] T078 [US3] 實作 HotspotService.get_in_bounds() in backend/src/services/hotspot_service.py（ST_MakeEnvelope 查詢、&& 運算子）
- [ ] T079 [P] [US3] 實作 GET /api/v1/hotspots/{hotspot_id} 路由 in backend/src/api/hotspots.py（參數：include_accidents）
- [ ] T080 [US3] 實作 HotspotService.get_by_id() in backend/src/services/hotspot_service.py（查詢單一熱點、可選關聯事故記錄）
- [ ] T081 [US3] 實作熱點排序邏輯 in backend/src/services/hotspot_service.py（按 total_accidents DESC，限制 limit 筆）

#### 前端實作：Mapbox 地圖整合

- [ ] T082 [P] [US3] 建立 MapView 元件 in frontend/src/components/Map/MapView.tsx（Mapbox GL JS 初始化、中心座標設定、縮放控制）
- [ ] T083 [P] [US3] 建立 HotspotLayer 元件 in frontend/src/components/Map/HotspotLayer.tsx（Circle layer 渲染、顏色映射依據嚴重程度）
- [ ] T084 [P] [US3] 建立 UserLocation 元件 in frontend/src/components/Map/UserLocation.tsx（顯示用戶當前位置標記）
- [ ] T085 [US3] 實作熱點資料載入邏輯 in frontend/src/store/hotspotsSlice.ts（fetchHotspotsInBounds thunk, 綁定地圖 bounds 變化）
- [ ] T086 [US3] 實作地圖事件監聽 in frontend/src/components/Map/MapView.tsx（moveend, zoomend 事件→觸發 fetchHotspotsInBounds）
- [ ] T087 [US3] 建立熱點詳細資訊彈窗 in frontend/src/components/Map/HotspotDetailPopup.tsx（中心座標、半徑、事故數量、等級比例圓餅圖）
- [ ] T088 [US3] 實作點擊熱點標記觸發彈窗 in frontend/src/components/Map/MapView.tsx（click 事件→fetch hotspot detail→顯示 popup）

#### 地圖視覺化優化

- [ ] T089 [US3] 實作熱點顏色映射邏輯 in frontend/src/components/Map/HotspotLayer.tsx（A1: 紅色、A2: 橙色、A3: 黃色，依 severity_score）
- [ ] T090 [US3] 實作熱點聚合顯示 in frontend/src/components/Map/HotspotLayer.tsx（縮小地圖時聚合、放大時展開）
- [ ] T091 [US3] 加入載入指示器 in frontend/src/components/Map/MapView.tsx（地圖載入、熱點查詢中顯示 spinner）

#### 驗證與除錯

- [ ] T092 [US3] 執行所有 US3 測試，確保通過
- [ ] T093 [US3] 手動測試：在地圖上移動、縮放、點擊標記，驗證所有互動正常

**Checkpoint**: 所有 User Stories（US1, US2, US3）都可獨立運作且完整整合

---

## Phase 6: 資料擷取與熱點分析 (Foundational for Data Pipeline)

**Purpose**: 實作資料擷取與熱點分析功能，支援系統運作

**Note**: 這些功能是系統運作的基礎，但不直接對應特定 User Story，因此放在獨立階段

### 資料擷取功能

#### 測試

- [ ] T094 [P] Unit test for A1 資料擷取 in backend/tests/unit/test_data_ingestion_a1.py（API 請求、JSON 解析、coordinate rounding）
- [ ] T095 [P] Unit test for A2 資料擷取 in backend/tests/unit/test_data_ingestion_a2.py（ZIP 解壓縮、JSON 解析、座標格式轉換）
- [ ] T096 [P] Unit test for A3 資料擷取 in backend/tests/unit/test_data_ingestion_a3.py（地理編碼呼叫、錯誤處理）
- [ ] T097 [P] Integration test for 完整資料擷取流程 in backend/tests/integration/test_full_ingestion.py（API→ETL→Database）

#### 實作

- [ ] T098 [P] 實作 A1 資料擷取 in backend/src/services/data_ingestion.py（ingest_a1() 方法：API 請求、經緯度四捨五入3位小數）
- [ ] T099 [P] 實作 A2 資料擷取 in backend/src/services/data_ingestion.py（ingest_a2() 方法：ZIP 下載、解壓縮、逐月 JSON 解析）
- [ ] T100 [US3] 實作 A3 資料擷取 in backend/src/services/data_ingestion.py（ingest_a3() 方法：呼叫 Geocoding Service）
- [ ] T101 [US3] 實作 Geocoding Service in backend/src/services/geocoding.py（geocode_address() 方法：Google Maps API、批次處理、rate limiting、錯誤重試）
- [ ] T102 實作資料去重邏輯 in backend/src/services/data_ingestion.py（檢查 source_type + source_id 唯一性約束）
- [ ] T103 實作 POST /api/v1/admin/ingest 路由 in backend/src/api/admin.py（參數：source_types, force_refresh, 回傳 job_id）
- [ ] T104 加入資料擷取日誌 in backend/src/services/data_ingestion.py（成功筆數、失敗筆數、錯誤詳情）

### 熱點分析功能

#### 測試

- [ ] T105 [P] Unit test for DBSCAN 聚類 in backend/tests/unit/test_hotspot_analysis_dbscan.py（scikit-learn 呼叫、參數驗證）
- [ ] T106 [P] Unit test for 熱點統計計算 in backend/tests/unit/test_hotspot_stats.py（center 計算、radius 計算、事故計數）
- [ ] T107 [P] Integration test for 完整熱點分析流程 in backend/tests/integration/test_full_analysis.py（Database→DBSCAN→寫回 Database）

#### 實作

- [ ] T108 實作 DBSCAN 聚類邏輯 in backend/src/services/hotspot_analysis.py（analyze_hotspots() 方法：scikit-learn DBSCAN, epsilon=500m, min_samples=5, metric=haversine）
- [ ] T109 實作熱點中心與半徑計算 in backend/src/services/hotspot_analysis.py（計算 cluster 質心、最大距離作為半徑）
- [ ] T110 實作事故統計計算 in backend/src/services/hotspot_analysis.py（a1_count, a2_count, a3_count, earliest/latest_accident_at）
- [ ] T111 實作熱點資料寫入 in backend/src/services/hotspot_analysis.py（建立 Hotspot 記錄、儲存 accident_ids JSONB）
- [ ] T112 實作 POST /api/v1/admin/analyze-hotspots 路由 in backend/src/api/admin.py（參數：analysis_period_days, epsilon_meters, min_samples）
- [ ] T113 加入熱點分析日誌 in backend/src/services/hotspot_analysis.py（分析執行時間、識別熱點數量、事故覆蓋率）

#### Cron 排程設定（部署後執行）

- [ ] T114 建立資料擷取 Cron 設定文件 in docs/cron-setup.md（每月1號凌晨2點執行 /api/v1/admin/ingest）
- [ ] T115 建立熱點分析 Cron 設定文件 in docs/cron-setup.md（每日凌晨3點執行 /api/v1/admin/analyze-hotspots）

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的改進與完善

### 效能優化

- [ ] T116 [P] 後端效能優化：加入 API response caching（Redis, 快取 5 分鐘）in backend/src/core/cache.py
- [ ] T117 [P] 前端效能優化：實作 Code Splitting in frontend/vite.config.ts（Mapbox SDK lazy loading）
- [ ] T118 [P] 資料庫查詢優化：驗證所有 PostGIS 索引正確使用（EXPLAIN ANALYZE 分析）in backend/docs/performance-tuning.md

### 錯誤處理與邊界案例

- [ ] T119 [P] 實作 GPS 訊號弱處理 in frontend/src/services/geolocation.ts（顯示警告訊息、暫停警示功能）
- [ ] T120 [P] 實作資料更新中提示 in frontend/src/pages/MapPage.tsx（當 hotspots 資料為空時顯示「資料更新中」）
- [ ] T121 [P] 實作多個重疊熱點處理 in backend/src/services/hotspot_service.py（優先顯示最高嚴重程度 A1 > A2 > A3）
- [ ] T122 [P] 實作地圖熱點過多聚合邏輯 in frontend/src/components/Map/HotspotLayer.tsx（超過 500 個熱點時只顯示高優先級）

### 文件與測試覆蓋率

- [ ] T123 [P] 更新 README.md in repository root（專案說明、安裝指南、使用繁體中文）
- [ ] T124 [P] 產生 API 文件：設定 FastAPI Swagger UI 中文化 in backend/src/main.py
- [ ] T125 [P] 執行測試覆蓋率檢查 in backend/（pytest --cov=src --cov-report=html, 目標 ≥ 80%）
- [ ] T126 [P] 執行前端測試覆蓋率檢查 in frontend/（npm run test:coverage, 目標 ≥ 80%）
- [ ] T127 驗證 quickstart.md 所有步驟可執行（從頭到尾跑一遍本地設定）

### 安全性強化

- [ ] T128 [P] 加入 API rate limiting in backend/src/core/middleware.py（每 IP 每分鐘 60 次請求）
- [ ] T129 [P] 實作管理端點認證 in backend/src/api/admin.py（JWT token 驗證、Bearer Auth）
- [ ] T130 [P] 前端環境變數驗證 in frontend/src/main.tsx（VITE_API_BASE_URL, VITE_MAPBOX_ACCESS_TOKEN 必填檢查）

### CI/CD 設定

- [ ] T131 [P] 建立後端 CI workflow in .github/workflows/backend-ci.yml（pytest, black, ruff）
- [ ] T132 [P] 建立前端 CI workflow in .github/workflows/frontend-ci.yml（npm test, npm run lint）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無相依性 - 可立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成 - **阻擋所有 User Stories**
- **User Stories (Phase 3-5)**: 全部依賴 Foundational 完成
  - 完成 Foundational 後，User Stories 可並行執行（若有足夠人力）
  - 或按優先順序循序執行（P1 → P2 → P3）
- **Data Pipeline (Phase 6)**: 可與 User Stories 並行，但建議在 US1 完成後開始（確保 API 可測試）
- **Polish (Phase 7)**: 依賴所有欲交付的 User Stories 完成

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完成後可開始 - 無其他 Story 相依性 ✅
- **User Story 2 (P2)**: Foundational 完成後可開始 - 與 US1 整合但可獨立測試
- **User Story 3 (P3)**: Foundational 完成後可開始 - 與 US1/US2 整合但可獨立測試

### Within Each User Story

- 測試必須先寫並確認 FAIL（TDD Red phase）
- Models before Services
- Services before Endpoints/UI
- 核心實作 before 整合
- Story 完成後再進入下一個優先級

### Parallel Opportunities

- Phase 1: T003, T004, T005, T007, T008 可並行
- Phase 2: T012-T013, T017-T020, T022-T024, T026-T028 可並行
- User Story 1: T031-T035（測試）, T041-T042, T045-T046 可並行
- User Story 2: T051-T055（測試）, T056-T059 可並行
- User Story 3: T072-T076（測試）, T082-T084 可並行
- Phase 6: T094-T097, T098-T099, T105-T107 可並行
- Phase 7: 大部分任務可並行（標記 [P]）

---

## Parallel Example: User Story 1

```bash
# 同時啟動 User Story 1 的所有測試（TDD Red phase）:
Task T031: "Contract test for GET /api/v1/hotspots/nearby"
Task T032: "Integration test for 熱點查詢流程"
Task T033: "Unit test for 距離計算邏輯"
Task T034: "Integration test for GPS定位與警示觸發"
Task T035: "Unit test for AlertService"

# 確認所有測試 FAIL 後，同時建立 Models（TDD Green phase）:
Task T041: "建立 Geolocation Service"
Task T042: "建立 Alert Service"
Task T045: "建立 AlertOverlay 元件"
Task T046: "建立 AlertIcon 元件"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（**CRITICAL** - 阻擋所有 Stories）
3. 完成 Phase 3: User Story 1
4. **STOP and VALIDATE**: 獨立測試 User Story 1
5. 若準備就緒，可部署/展示 MVP

### Incremental Delivery

1. 完成 Setup + Foundational → 基礎就緒
2. 加入 User Story 1 → 獨立測試 → 部署/展示（**MVP!**）
3. 加入 User Story 2 → 獨立測試 → 部署/展示
4. 加入 User Story 3 → 獨立測試 → 部署/展示
5. 加入 Phase 6（資料擷取與分析）→ 系統完整運作
6. 完成 Phase 7（Polish）→ 生產就緒
7. 每個 Story 都增加價值且不破壞已有功能

### Parallel Team Strategy

若有多位開發者：

1. 團隊一起完成 Setup + Foundational
2. Foundational 完成後：
   - 開發者 A: User Story 1（後端 + 前端）
   - 開發者 B: User Story 2（後端 + 前端）
   - 開發者 C: User Story 3（後端 + 前端）
   - 開發者 D: Phase 6（資料擷取與分析）
3. Stories 獨立完成並整合

### 前後端分工策略

若前後端分開開發：

1. 後端優先完成 Foundational 中的 API 框架（T016-T021）
2. 前端等待後端完成後，根據 contracts/openapi.yaml 開始並行開發
3. 每個 User Story 內：
   - 後端先完成 API（T036-T040）
   - 前端同時可開始 UI 元件（T041-T046）
   - 最後整合測試（T049-T050）

---

## Notes

- **[P] 任務** = 不同檔案、無相依性，可並行執行
- **[Story] 標籤** = 將任務映射到特定 User Story，便於追蹤
- 每個 User Story 應可獨立完成與測試
- **TDD 強制**: 先寫測試，確認 FAIL，再實作
- 每個任務或邏輯群組完成後提交 commit
- 在任何 Checkpoint 停下來驗證 Story 獨立性
- **避免**: 模糊任務、同檔案衝突、破壞獨立性的跨 Story 相依性

---

## Summary

- **總任務數**: 132 個任務
- **User Story 任務分布**:
  - US1（即時警示）: 20 個任務（T031-T050）
  - US2（客製化設定）: 21 個任務（T051-T071）
  - US3（地圖視覺化）: 22 個任務（T072-T093）
  - 資料管線: 22 個任務（T094-T115）
  - 其他（Setup/Foundational/Polish）: 47 個任務
- **並行機會**: 50+ 任務標記 [P] 可平行執行
- **獨立測試標準**: 每個 User Story 都有明確的獨立測試方法
- **建議 MVP 範圍**: Phase 1 + Phase 2 + Phase 3（User Story 1 only）= ~50 個任務
- **格式驗證**: ✅ 所有任務遵循 checklist 格式（checkbox, ID, labels, file paths）
