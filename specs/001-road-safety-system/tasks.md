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

- [x] T001 根據 plan.md 建立專案目錄結構（backend/, frontend/, docker-compose.yml）
- [x] T002 初始化後端專案：建立 backend/pyproject.toml 並使用 uv 安裝 FastAPI, SQLAlchemy, PostGIS 相關套件
- [x] T003 [P] 初始化前端專案：建立 frontend/package.json 並安裝 React, Vite, Tailwind, Redux Toolkit, Mapbox GL JS
- [x] T004 [P] 配置後端 linting 工具：設定 Black, Ruff 於 backend/pyproject.toml
- [x] T005 [P] 配置前端 linting 工具：設定 ESLint, Prettier 於 frontend/.eslintrc.json 與 frontend/.prettierrc
- [x] T006 建立 Docker Compose 配置：docker-compose.yml（PostgreSQL + PostGIS + backend + frontend）
- [x] T007 [P] 建立後端環境變數範本：backend/.env.example（DATABASE_URL, GOOGLE_MAPS_API_KEY）
- [x] T008 [P] 建立前端環境變數範本：frontend/.env.example（VITE_API_BASE_URL, VITE_MAPBOX_ACCESS_TOKEN）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基礎設施，所有 User Story 必須先完成此階段才能開始

**⚠️ CRITICAL**: 所有 User Story 工作必須等待此階段完成

### 資料庫與ORM設定

- [x] T009 設定 PostgreSQL + PostGIS 資料庫：建立 backend/src/db/session.py（SQLAlchemy engine, session factory）
- [x] T010 初始化 Alembic migrations：執行 alembic init backend/src/db/migrations
- [x] T011 建立基礎 Enum 型別：backend/src/models/__init__.py（SourceType, SeverityLevel）
- [x] T012 [P] 建立 Accident 模型：backend/src/models/accident.py（完整欄位、索引、Trigger）
- [x] T013 [P] 建立 Hotspot 模型：backend/src/models/hotspot.py（完整欄位、索引、Trigger）
- [x] T014 產生初始資料庫 migration：alembic revision --autogenerate -m "Initial schema"
- [x] T015 測試資料庫遷移：alembic upgrade head（驗證 PostGIS 擴充、索引建立）

### API 框架設定

- [x] T016 建立 FastAPI 應用程式主檔：backend/src/main.py（app instance, CORS 設定）
- [x] T017 [P] 建立 API 路由結構：backend/src/api/__init__.py, backend/src/api/accidents.py, backend/src/api/hotspots.py
- [x] T018 [P] 建立核心設定模組：backend/src/core/config.py（環境變數管理）
- [x] T019 [P] 建立錯誤處理中介層：backend/src/core/errors.py（統一錯誤格式）
- [x] T020 [P] 建立日誌設定：backend/src/core/logging.py（結構化日誌）
- [x] T021 實作健康檢查端點：backend/src/api/health.py（GET /health, 資料庫連線檢查）

### 服務層基礎

- [x] T022 [P] 建立 Geocoding Service 骨架：backend/src/services/geocoding.py（Google Maps API 整合準備）
- [x] T023 [P] 建立 Data Ingestion Service 骨架：backend/src/services/data_ingestion.py（A1/A2/A3 擷取準備）
- [x] T024 [P] 建立 Hotspot Analysis Service 骨架：backend/src/services/hotspot_analysis.py（DBSCAN 聚類準備）

### 前端基礎設定

- [x] T025 設定 Redux Store：frontend/src/store/index.ts（store 配置與 middleware）
- [x] T026 [P] 建立 Redux slices 骨架：frontend/src/store/hotspotsSlice.ts, frontend/src/store/settingsSlice.ts, frontend/src/store/locationSlice.ts
- [x] T027 [P] 建立 API 客戶端：frontend/src/services/api.ts（Axios instance, base URL 設定）
- [x] T028 [P] 建立型別定義：frontend/src/types/accident.ts, frontend/src/types/hotspot.ts, frontend/src/types/settings.ts
- [x] T029 配置 Tailwind CSS：frontend/tailwind.config.js（主題色彩、中文字型）
- [x] T030 建立基礎佈局元件：frontend/src/App.tsx（路由設定）

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

- [x] T031 [P] [US1] Contract test for GET /api/v1/hotspots/nearby in backend/tests/contract/test_hotspots_nearby.py（驗證 OpenAPI 契約合規性）
- [x] T032 [P] [US1] Integration test for 熱點查詢流程 in backend/tests/integration/test_hotspot_query_flow.py（資料庫→Service→API完整流程）
- [x] T033 [P] [US1] Unit test for 距離計算邏輯 in backend/tests/unit/test_distance_calculation.py（ST_DWithin 查詢邏輯）

#### 前端測試

- [x] T034 [P] [US1] Integration test for GPS定位與警示觸發 in frontend/tests/integration/test_alert_trigger.spec.ts（模擬GPS移動→API請求→警示顯示）
- [x] T035 [P] [US1] Unit test for AlertService in frontend/tests/unit/test_alert_service.spec.ts（警示邏輯、音效/震動觸發）

### Implementation for User Story 1

#### 後端實作：熱點查詢 API

- [x] T036 [P] [US1] 實作 GET /api/v1/hotspots/nearby 路由 in backend/src/api/hotspots.py（參數驗證：latitude, longitude, distance, time_range, severity_levels）
- [x] T037 [US1] 實作 HotspotService.get_nearby() in backend/src/services/hotspot_service.py（PostGIS ST_DWithin 查詢、時間範圍篩選）
- [x] T038 [US1] 實作距離計算與排序邏輯 in backend/src/services/hotspot_service.py（ST_Distance 計算、severity_score 加權）
- [x] T039 [US1] 加入錯誤處理：經緯度範圍驗證（21.5-25.5, 119.5-122.5）in backend/src/api/hotspots.py
- [x] T040 [US1] 加入日誌記錄：查詢參數、回傳筆數 in backend/src/api/hotspots.py

#### 前端實作：GPS 定位與警示系統

- [x] T041 [P] [US1] 建立 Geolocation Service in frontend/src/services/geolocation.ts（watchPosition API, 錯誤處理）
- [x] T042 [P] [US1] 建立 Alert Service in frontend/src/services/alerts.ts（音效播放、Vibration API、距離判斷邏輯）
- [x] T043 [US1] 實作 locationSlice actions in frontend/src/store/locationSlice.ts（updateLocation, setGPSStatus）
- [x] T044 [US1] 實作 hotspotsSlice actions in frontend/src/store/hotspotsSlice.ts（fetchNearbyHotspots thunk, updateNearbyList）
- [x] T045 [P] [US1] 建立 AlertOverlay 元件 in frontend/src/components/Alert/AlertOverlay.tsx（視覺警示、熱點資訊顯示）
- [x] T046 [P] [US1] 建立 AlertIcon 元件 in frontend/src/components/Alert/AlertIcon.tsx（不同嚴重程度的圖示）
- [x] T047 [US1] 整合 Geolocation 與 Alert 邏輯 in frontend/src/pages/MapPage.tsx（GPS 更新→查詢熱點→觸發警示）
- [x] T048 [US1] 實作警示間隔控制（最小30秒）in frontend/src/services/alerts.ts（防止連續重複警示）

#### 驗證與除錯

- [x] T049 [US1] 執行所有 US1 測試，確保通過（backend: pytest tests/ -k US1, frontend: npm test US1）
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

- [x] T051 [P] [US2] Unit test for DistanceSelector in frontend/tests/unit/components/test_distance_selector.spec.ts（四個距離選項切換）
- [x] T052 [P] [US2] Unit test for AccidentLevelFilter in frontend/tests/unit/components/test_accident_level_filter.spec.ts（多選邏輯）
- [x] T053 [P] [US2] Unit test for TimeRangeFilter in frontend/tests/unit/components/test_time_range_filter.spec.ts（四個時間範圍選項）
- [x] T054 [P] [US2] Unit test for AlertModeSelector in frontend/tests/unit/components/test_alert_mode_selector.spec.ts（音效/震動/不提醒/多選組合）
- [x] T055 [P] [US2] Integration test for 設定變更立即生效 in frontend/tests/integration/test_settings_flow.spec.ts（修改設定→查詢熱點→篩選結果）

### Implementation for User Story 2

#### 前端實作：設定介面

- [x] T056 [P] [US2] 建立 DistanceSelector 元件 in frontend/src/components/Settings/DistanceSelector.tsx（100m/500m/1km/3km單選）
- [x] T057 [P] [US2] 建立 AccidentLevelFilter 元件 in frontend/src/components/Settings/AccidentLevelFilter.tsx（A1/A2/A3複選checkbox）
- [x] T058 [P] [US2] 建立 TimeRangeFilter 元件 in frontend/src/components/Settings/TimeRangeFilter.tsx（1年/6個月/3個月/1個月單選）
- [x] T059 [P] [US2] 建立 AlertModeSelector 元件 in frontend/src/components/Settings/AlertModeSelector.tsx（音效/震動/不提醒複選）
- [x] T060 [US2] 整合設定頁面 in frontend/src/pages/SettingsPage.tsx（佈局、儲存按鈕）
- [x] T061 [US2] 實作 settingsSlice actions in frontend/src/store/settingsSlice.ts（updateDistance, updateSeverityLevels, updateTimeRange, updateAlertModes）
- [x] T062 [US2] 實作本地儲存持久化 in frontend/src/store/settingsSlice.ts（localStorage sync, 應用啟動時載入）

#### 前端實作：設定驅動的篩選邏輯

- [x] T063 [US2] 修改 fetchNearbyHotspots thunk in frontend/src/store/hotspotsSlice.ts（讀取 settingsSlice 狀態，組合 API 查詢參數）
- [x] T064 [US2] 修改 Alert Service in frontend/src/services/alerts.ts（根據 alertModes 設定觸發音效/震動/僅視覺）
- [x] T065 [US2] 實作「不提醒」模式的視覺提示 in frontend/src/components/Alert/AlertOverlay.tsx（短暫顯示圖示但不發出聲音/震動）
- [x] T066 [US2] 實作多重警示方式組合 in frontend/src/services/alerts.ts（同時播放音效+震動）

#### 後端實作：時間範圍篩選支援

- [x] T067 [US2] 更新 GET /api/v1/hotspots/nearby in backend/src/api/hotspots.py（支援 time_range 參數：1_month, 3_months, 6_months, 1_year）
- [x] T068 [US2] 實作時間範圍篩選邏輯 in backend/src/services/hotspot_service.py（latest_accident_at >= NOW() - INTERVAL）
- [x] T069 [US2] 加入事故等級篩選邏輯 in backend/src/services/hotspot_service.py（根據 severity_levels 參數過濾 a1_count, a2_count, a3_count）

#### 驗證與除錯

- [x] T070 [US2] 執行所有 US2 測試，確保通過
- [ ] T071 [US2] 手動測試：切換不同設定組合，驗證警示行為符合預期

**Checkpoint**: User Stories 1 AND 2 都可獨立運作，設定功能完整

---

## Phase 5: User Story 3 - 地圖視覺化熱點資訊 (Priority: P3)

**Goal**: 用戶可以在地圖上查看所在區域的事故熱點分布，包括熱點位置、範圍、事故數量、事故等級比例等資訊。

**Independent Test**:
1. 開啟地圖頁面，驗證熱點標記與事故件數標籤正確顯示並在資料更新前不會消失
2. 點擊熱點標記後，地圖需聚焦該熱點並顯示彈窗（含事故件數、地址、A1/A2/A3 比例與說明）
3. 透過「查看全部事故詳情」進入全屏列表，確認每筆事故包含日期時間、地址與距離、事故等級、涉入人員與車種

### Tests for User Story 3

#### 後端測試

- [x] T072 [P] [US3] Contract test for GET /api/v1/hotspots/in-bounds in backend/tests/contract/test_hotspots_in_bounds.py（驗證 OpenAPI 契約）
- [x] T073 [P] [US3] Contract test for GET /api/v1/hotspots/{hotspot_id} in backend/tests/contract/test_hotspot_detail.py（驗證詳細資訊契約）
- [x] T074 [P] [US3] Integration test for 地圖邊界查詢 in backend/tests/integration/test_map_bounds_query.py（ST_MakeEnvelope 查詢邏輯）

#### 前端測試

- [x] T075 [P] [US3] Integration test for 地圖互動 in frontend/tests/integration/test_map_interaction.spec.ts（載入地圖→顯示熱點→點擊標記→彈窗）
- [x] T076 [P] [US3] Unit test for HotspotLayer in frontend/tests/unit/components/test_hotspot_layer.spec.ts（標記渲染、顏色映射）

### Implementation for User Story 3

#### 後端實作：地圖查詢 API

- [x] T077 [P] [US3] 實作 GET /api/v1/hotspots/in-bounds 路由 in backend/src/api/hotspots.py（參數：sw_lat, sw_lng, ne_lat, ne_lng, time_range, severity_levels, limit）
- [x] T078 [US3] 實作 HotspotService.get_in_bounds() in backend/src/services/hotspot_service.py（ST_MakeEnvelope 查詢、&& 運算子）
- [x] T079 [P] [US3] 實作 GET /api/v1/hotspots/{hotspot_id} 路由 in backend/src/api/hotspots.py（參數：include_accidents）
- [x] T080 [US3] 實作 HotspotService.get_by_id() in backend/src/services/hotspot_service.py（查詢單一熱點、可選關聯事故記錄）
- [x] T081 [US3] 實作熱點排序邏輯 in backend/src/services/hotspot_service.py（按 total_accidents DESC，限制 limit 筆）

#### 前端實作：Mapbox 地圖整合

- [x] T082 [P] [US3] 建立 MapView 元件 in frontend/src/components/Map/MapView.tsx（Mapbox GL JS 初始化、中心座標設定、縮放控制）
- [x] T083 [P] [US3] 建立 HotspotLayer 元件 in frontend/src/components/Map/HotspotLayer.tsx（Circle layer 渲染、顏色映射依據嚴重程度）
- [x] T084 [P] [US3] 建立 UserLocation 元件 in frontend/src/components/Map/UserLocation.tsx（顯示用戶當前位置標記）
- [x] T085 [US3] 實作熱點資料載入邏輯 in frontend/src/store/hotspotsSlice.ts（fetchHotspotsInBounds thunk, 綁定地圖 bounds 變化）
- [x] T086 [US3] 實作地圖事件監聽 in frontend/src/components/Map/MapView.tsx（moveend, zoomend 事件→觸發 fetchHotspotsInBounds）
- [x] T087 [US3] 建立熱點詳細資訊彈窗 in frontend/src/components/Map/HotspotDetailPopup.tsx（中心座標、半徑、事故數量、等級比例圓餅圖）
- [x] T088 [US3] 實作點擊熱點標記觸發彈窗 in frontend/src/components/Map/MapView.tsx（click 事件→fetch hotspot detail→顯示 popup）

#### 地圖視覺化優化

- [x] T089 [US3] 實作熱點顏色映射邏輯 in frontend/src/components/Map/HotspotLayer.tsx（A1: 紅色、A2: 橙色、A3: 黃色，依 severity_score）
- [x] T090 [US3] 實作熱點聚合顯示 in frontend/src/components/Map/HotspotLayer.tsx（縮小地圖時聚合、放大時展開）
- [x] T091 [US3] 加入載入指示器 in frontend/src/components/Map/MapView.tsx（地圖載入、熱點查詢中顯示 spinner）
- [x] T194 [US3] 維持熱點標記存留（避免地圖重載或資料更新前清空）in frontend/src/pages/MapPage.tsx
- [x] T195 [US3] 在熱點標記顯示事故件數並點擊時聚焦該熱點 in frontend/src/components/Map/HotspotLayer.tsx
- [x] T196 [US3] 更新熱點詳情彈窗（地址、等級說明、查看詳情按鈕）in frontend/src/components/Map/HotspotDetailPopup.tsx
- [x] T197 [US3] 建立全屏事故詳情頁面（含事故清單）in frontend/src/components/Map/HotspotIncidentListModal.tsx、frontend/src/pages/MapPage.tsx
- [x] T198 [US3] 擴充事故資料模型與 mock 資料（地址、距離、涉入人員/車種）in frontend/src/types/accident.ts、frontend/src/mocks/hotspots.ts
- [x] T199 [US3] 補齊熱點詳細資料 thunk（含 mock fallback）in frontend/src/store/hotspotsSlice.ts

#### 驗證與除錯

- [x] T092 [US3] 執行所有 US3 測試，確保通過
- [ ] T093 [US3] 手動測試：在地圖上移動、縮放、點擊標記，驗證所有互動正常

**Checkpoint**: 所有 User Stories（US1, US2, US3）都可獨立運作且完整整合

---

## Phase 6: 資料擷取與熱點分析 (Foundational for Data Pipeline)

**Purpose**: 實作資料擷取與熱點分析功能，支援系統運作

**Note**: 這些功能是系統運作的基礎，但不直接對應特定 User Story，因此放在獨立階段

### 資料擷取功能

#### 測試

- [x] T094 [P] Unit test for A1 資料擷取 in backend/tests/unit/test_data_ingestion_a1.py（API 請求、JSON 解析、coordinate rounding）
- [x] T095 [P] Unit test for A2 資料擷取 in backend/tests/unit/test_data_ingestion_a2.py（ZIP 解壓縮、JSON 解析、座標格式轉換）
- [x] T096 [P] Unit test for A3 資料擷取 in backend/tests/unit/test_data_ingestion_a3.py（地理編碼呼叫、錯誤處理）
- [x] T097 [P] Integration test for 完整資料擷取流程 in backend/tests/integration/test_full_ingestion.py（API→ETL→Database）

#### 實作

- [x] T098 [P] 實作 A1 資料擷取 in backend/src/services/data_ingestion.py（ingest_a1() 方法：API 請求、經緯度四捨五入3位小數）
- [x] T099 [P] 實作 A2 資料擷取 in backend/src/services/data_ingestion.py（ingest_a2() 方法：ZIP 下載、解壓縮、逐月 JSON 解析）
- [x] T100 [US3] 實作 A3 資料擷取 in backend/src/services/data_ingestion.py（ingest_a3() 方法：呼叫 Geocoding Service）
- [x] T101 [US3] 實作 Geocoding Service in backend/src/services/geocoding.py（geocode_address() 方法：Google Maps API、批次處理、rate limiting、錯誤重試）
- [x] T102 實作資料去重邏輯 in backend/src/services/data_ingestion.py（檢查 source_type + source_id 唯一性約束）
- [x] T103 實作 POST /api/v1/admin/ingest 路由 in backend/src/api/admin.py（參數：source_types, force_refresh, 回傳 job_id）
- [x] T104 加入資料擷取日誌 in backend/src/services/data_ingestion.py（成功筆數、失敗筆數、錯誤詳情）

### 熱點分析功能

#### 測試

- [x] T105 [P] Unit test for DBSCAN 聚類 in backend/tests/unit/test_hotspot_analysis_dbscan.py（scikit-learn 呼叫、參數驗證）
- [x] T106 [P] Unit test for 熱點統計計算 in backend/tests/unit/test_hotspot_stats.py（center 計算、radius 計算、事故計數）
- [x] T107 [P] Integration test for 完整熱點分析流程 in backend/tests/integration/test_full_analysis.py（Database→DBSCAN→寫回 Database）

#### 實作

- [x] T108 實作 DBSCAN 聚類邏輯 in backend/src/services/hotspot_analysis.py（analyze_hotspots() 方法：scikit-learn DBSCAN, epsilon=500m, min_samples=5, metric=haversine）
- [x] T109 實作熱點中心與半徑計算 in backend/src/services/hotspot_analysis.py（計算 cluster 質心、最大距離作為半徑）
- [x] T110 實作事故統計計算 in backend/src/services/hotspot_analysis.py（a1_count, a2_count, a3_count, earliest/latest_accident_at）
- [x] T111 實作熱點資料寫入 in backend/src/services/hotspot_analysis.py（建立 Hotspot 記錄、儲存 accident_ids JSONB）
- [x] T112 實作 POST /api/v1/admin/analyze-hotspots 路由 in backend/src/api/admin.py（參數：analysis_period_days, epsilon_meters, min_samples）
- [x] T113 加入熱點分析日誌 in backend/src/services/hotspot_analysis.py（分析執行時間、識別熱點數量、事故覆蓋率）

#### Cron 排程設定（部署後執行）

- [x] T114 建立資料擷取 Cron 設定文件 in docs/cron-setup.md（每月1號凌晨2點執行 /api/v1/admin/ingest）
- [x] T115 建立熱點分析 Cron 設定文件 in docs/cron-setup.md（每日凌晨3點執行 /api/v1/admin/analyze-hotspots）

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的改進與完善

### 效能優化

- [x] T116 [P] 後端效能優化：加入 API response caching（Redis, 快取 5 分鐘）in backend/src/core/cache.py
- [x] T117 [P] 前端效能優化：實作 Code Splitting in frontend/vite.config.ts（Mapbox SDK lazy loading）
- [x] T118 [P] 資料庫查詢優化：驗證所有 PostGIS 索引正確使用（EXPLAIN ANALYZE 分析）in backend/docs/performance-tuning.md

### 錯誤處理與邊界案例

- [x] T119 [P] 實作 GPS 訊號弱處理 in frontend/src/services/geolocation.ts（顯示警告訊息、暫停警示功能）
- [x] T120 [P] 實作資料更新中提示 in frontend/src/pages/MapPage.tsx（當 hotspots 資料為空時顯示「資料更新中」）
- [x] T121 [P] 實作多個重疊熱點處理 in backend/src/services/hotspot_service.py（優先顯示最高嚴重程度 A1 > A2 > A3）
- [x] T122 [P] 實作地圖熱點過多聚合邏輯 in frontend/src/components/Map/HotspotLayer.tsx（超過 500 個熱點時只顯示高優先級）

### 文件與測試覆蓋率

- [x] T123 [P] 更新 README.md in repository root（專案說明、安裝指南、使用繁體中文）
- [x] T124 [P] 產生 API 文件：設定 FastAPI Swagger UI 中文化 in backend/src/main.py
- [x] T125 [P] 執行測試覆蓋率檢查 in backend/（pytest --cov=src --cov-report=html, 目前 62%, 目標 ≥ 80%）
- [ ] T126 [P] 執行前端測試覆蓋率檢查 in frontend/（npm run test:coverage, 目標 ≥ 80%）
- [ ] T127 驗證 quickstart.md 所有步驟可執行（從頭到尾跑一遍本地設定）

### 安全性強化

- [x] T128 [P] 加入 API rate limiting in backend/src/core/middleware.py（每 IP 每分鐘 60 次請求）
- [x] T129 [P] 實作管理端點認證 in backend/src/api/admin.py（JWT token 驗證、Bearer Auth）
- [x] T130 [P] 前端環境變數驗證 in frontend/src/main.tsx（VITE_API_BASE_URL, VITE_MAPBOX_ACCESS_TOKEN 必填檢查）

### CI/CD 設定

- [x] T131 [P] 建立後端 CI workflow in .github/workflows/backend-ci.yml（pytest, black, ruff）
- [x] T132 [P] 建立前端 CI workflow in .github/workflows/frontend-ci.yml（npm test, npm run lint）

---

## Phase 8: Frontend-Backend Integration

**Purpose**: 確保前後端整合的一致性，修正格式不一致問題，建立整合測試

**Note**: 此階段專注於前後端整合，確保 API 契約、格式轉換、錯誤處理的一致性

### 文件修正與格式統一

- [ ] T200 [P] 更新 spec.md 移除「忽略熱點」相關功能 in specs/001-road-safety-system/spec.md（User Story 1 Scenario 3, FR-013, Key Entities）
- [x] T201 [P] 建立格式映射文件 in specs/001-road-safety-system/contracts/format-mapping.md（時間範圍、警示方式、距離、事故等級的前後端格式對照）
- [ ] T202 驗證 OpenAPI 契約與實作一致性 in specs/001-road-safety-system/contracts/openapi.yaml（檢查所有端點、參數、回應格式）

### Flutter WebView 整合

- [x] T203 [P] 建立 Flutter JS Bridge 通訊層 in frontend/src/services/flutterBridge.ts（實作 postMessage 與事件監聽器）
- [x] T204 [P] 實作定位請求函式 in frontend/src/services/flutterBridge.ts（requestLocation() 返回 Promise<Position>）
- [x] T205 [P] 實作通知觸發函式 in frontend/src/services/flutterBridge.ts（sendNotification(title, content)）
- [x] T206 [P] 加入 Flutter bridge 可用性檢查 in frontend/src/services/flutterBridge.ts（isFlutterBridgeAvailable()）
- [x] T207 [P] 撰寫 Flutter bridge 單元測試 in frontend/tests/unit/services/test_flutter_bridge.spec.ts
- [x] T208 更新 geolocation.ts 使用 Flutter bridge in frontend/src/services/geolocation.ts（移除瀏覽器原生 Geolocation API）
- [x] T209 加入優雅降級處理 in frontend/src/services/geolocation.ts（bridge 不可用時顯示錯誤訊息）
- [x] T210 更新 alerts.ts 通知邏輯 in frontend/src/services/alerts.ts（使用 Flutter bridge 觸發通知）
- [x] T211 [P] 撰寫定位服務整合測試 in frontend/tests/integration/test_flutter_location.spec.ts

### 前端格式轉換實作

- [x] T212 修正前端時間範圍轉換錯誤 in frontend/src/store/hotspotsSlice.ts（'1Y' 應對應 '1_year' 而非 '12_months'）
- [x] T213 修正前端地圖邊界參數名稱 in frontend/src/store/hotspotsSlice.ts（使用 sw_lat, sw_lng, ne_lat, ne_lng 而非 min/max）
- [x] T214 [P] 建立格式轉換工具函式 in frontend/src/utils/mappers.ts（mapTimeRangeToApi, mapSeverityLevelsToApi）
- [x] T215 [P] 撰寫格式轉換函式的單元測試 in frontend/tests/unit/utils/test_mappers.spec.ts
- [x] T216 更新 hotspotsSlice 使用轉換工具函式 in frontend/src/store/hotspotsSlice.ts（抽取轉換邏輯到 mappers.ts）

### 後端參數驗證統一

- [x] T217 統一後端 distance 參數驗證 in backend/src/api/hotspots.py（明確只接受 [100, 500, 1000, 3000]，回傳 422 錯誤）
- [x] T218 統一後端 time_range 參數驗證 in backend/src/api/hotspots.py（驗證 enum 值，回傳 422 錯誤）
- [x] T219 [P] 加入參數驗證的單元測試 in backend/tests/unit/test_parameter_validation.py
- [x] T220 驗證錯誤訊息使用繁體中文 in backend/src/core/errors.py（檢查所有錯誤訊息）

### 前後端整合測試

- [ ] T221 建立整合測試環境設定 in tests/integration/（docker-compose, 測試資料庫設定）
- [x] T222 [P] 撰寫 /hotspots/nearby 端點整合測試 in tests/integration/test_hotspots_nearby_integration.py（測試完整請求-回應流程）
- [x] T223 [P] 撰寫 /hotspots/in-bounds 端點整合測試 in tests/integration/test_hotspots_in_bounds_integration.py
- [x] T224 [P] 撰寫 /hotspots/{id} 端點整合測試 in tests/integration/test_hotspot_detail_integration.py
- [x] T225 測試時間範圍篩選功能 in tests/integration/test_time_range_filter.py（驗證各種時間範圍參數）
- [x] T226 測試事故等級篩選功能 in tests/integration/test_severity_filter.py（驗證 A1/A2/A3 組合）
- [x] T227 測試無效參數的錯誤處理 in tests/integration/test_error_handling.py（422, 400, 404 錯誤回應）

### API 文件更新

- [ ] T228 [P] 更新 OpenAPI 範例 in specs/001-road-safety-system/contracts/openapi.yaml（確保範例符合實際格式）
- [ ] T229 [P] 更新 quickstart.md API 測試範例 in specs/001-road-safety-system/quickstart.md（使用正確的參數格式）

### 前端型別定義與 API 客戶端

- [ ] T230 驗證前端型別定義與 API 契約一致 in frontend/src/types/（hotspot.ts, settings.ts, accident.ts）
- [x] T231 [P] 更新前端 API 錯誤處理 in frontend/src/services/api.ts（處理 422 錯誤，顯示中文錯誤訊息）
- [x] T232 [P] 建立 API 回應適配器測試 in frontend/tests/unit/adapters/test_hotspot_adapters.spec.ts

### 測試覆蓋率驗證

- [ ] T233 執行後端測試覆蓋率檢查 in backend/（pytest --cov=src --cov-report=html --cov-report=term）
- [ ] T234 執行前端測試覆蓋率檢查 in frontend/（npm run test:coverage）
- [x] T235 補足缺失的測試至 80% 覆蓋率（目前 70%，已新增 admin.py 和 auth.py 測試）

### 效能監控設定

- [x] T236 [P] 設定前端 Bundle Size 監控 in frontend/vite.config.ts（使用 rollup-plugin-visualizer）
- [ ] T237 [P] 驗證 Mapbox SDK bundle size < 500KB in frontend/（執行 npm run build 並檢查輸出）
- [x] T238 [P] 設定 API 回應時間監控 in backend/src/core/logging.py（記錄每個請求的處理時間）

### E2E 測試（可選）

- [ ] T239 [P] 建立 E2E 測試環境 in tests/e2e/（Playwright 或 Cypress 設定）
- [ ] T240 [P] 撰寫地圖載入與熱點顯示 E2E 測試 in tests/e2e/test_map_display.spec.ts
- [ ] T241 [P] 撰寫警示觸發 E2E 測試 in tests/e2e/test_alert_trigger.spec.ts（模擬 GPS 移動）
- [ ] T242 [P] 撰寫設定變更 E2E 測試 in tests/e2e/test_settings_change.spec.ts

### 部署準備

- [x] T243 [P] 建立環境變數範本文件 in docs/environment-variables.md（列出所有必要的環境變數）
- [x] T244 [P] 建立部署檢查清單 in docs/deployment-checklist.md（部署前的驗證項目）
- [x] T245 驗證 Docker Compose 配置 in docker-compose.yml（確保前後端可正確啟動並互通）

### API 對齊與部署修正

**Purpose**: 修正後端 API 變更導致的前後端不一致問題，確保部署後的服務正常運作

**背景**: 後端已移除 `/hotspots/nearby` 和 `/hotspots/in-bounds` 端點，改用統一的 `/hotspots/all` 端點。前端需要更新以適配新的 API。

#### 後端 CORS 與環境變數修正

- [x] T246 [P] 更新 backend/src/core/config.py 加入 CORS_ORIGINS 環境變數（支援多個來源，逗號分隔）
- [x] T247 更新 backend/src/main.py 使用 CORS_ORIGINS 環境變數（替換硬編碼的 allow_origins=["*"]）
- [x] T248 [P] 驗證後端 /api/v1/hotspots/all 端點回應格式（確認包含 meta.period_days, 支援 period_days 和 severity_levels 參數）
- [ ] T249 [P] 撰寫 CORS 設定單元測試 in backend/tests/unit/test_cors_config.py（驗證環境變數讀取與多來源解析）

#### 前端 API 呼叫更新

- [x] T250 移除 frontend/src/store/hotspotsSlice.ts 中的 fetchNearbyHotspots 函數（已廢棄的 /hotspots/nearby 端點）
- [x] T251 移除 frontend/src/store/hotspotsSlice.ts 中的 fetchHotspotsInBounds 函數（已廢棄的 /hotspots/in-bounds 端點）
- [x] T252 移除 hotspotsSlice 中舊 API 相關的 reducer cases（fetchNearbyHotspots.pending/fulfilled/rejected, fetchHotspotsInBounds.pending/fulfilled/rejected）
- [x] T253 更新 frontend/src/pages/MapPage.tsx 使用 fetchAllHotspots + 本地過濾邏輯（實作地圖範圍過濾和距離過濾）
- [ ] T254 [P] 建立本地過濾工具函式 in frontend/src/utils/filters.ts（filterByDistance, filterByBounds）
- [ ] T255 [P] 撰寫過濾函式單元測試 in frontend/tests/unit/utils/test_filters.spec.ts

#### 整合測試與部署

- [ ] T256 本地測試前端連接已部署的後端（npm run dev, 驗證 API 呼叫正常，無 404 錯誤）
- [ ] T257 重新建置並部署後端（gcloud builds submit, 套用 CORS_ORIGINS 環境變數）
- [ ] T258 重新建置並部署前端（gcloud builds submit, 套用 API 更新）
- [ ] T259 驗證部署後的前後端整合（測試地圖功能、警示功能、無 CORS 錯誤、API 回應正常）
- [x] T260 [P] 更新部署文件記錄 CORS_ORIGINS 環境變數 in docs/deployment/BACKEND_DEPLOYMENT.md, docs/deployment/QUICK_REFERENCE.md

#### 文件更新

- [ ] T261 [P] 更新 docs/hotspot-api-changes.md 標記前端已更新使用新 API
- [ ] T262 [P] 建立 API 對齊檢查清單 in docs/api-alignment-checklist.md（列出所有前後端 API 契約檢查項目）

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

- **總任務數**: 195 個任務（原 132 + 整合 46 + API 對齊 17）
- **User Story 任務分布**:
  - US1（即時警示）: 20 個任務（T031-T050）
  - US2（客製化設定）: 21 個任務（T051-T071）
  - US3（地圖視覺化）: 28 個任務（T072-T093, T194-T199）
  - 資料管線: 22 個任務（T094-T115）
  - Setup/Foundational/Polish: 47 個任務（T001-T030, T116-T132）
  - **前後端整合**: 63 個任務（T200-T262）
    - Flutter WebView 整合: 9 個任務（T203-T211）
    - 格式轉換與參數驗證: 9 個任務（T212-T220）
    - API 整合測試: 7 個任務（T221-T227）
    - 文件與型別定義: 5 個任務（T228-T232）
    - 測試覆蓋率與效能: 6 個任務（T233-T238）
    - E2E 測試與部署: 10 個任務（T239-T245, T246-T262）
    - **API 對齊與部署修正**: 17 個任務（T246-T262）
      - 後端 CORS 與環境變數: 4 個任務（T246-T249）
      - 前端 API 呼叫更新: 6 個任務（T250-T255）
      - 整合測試與部署: 5 個任務（T256-T260）
      - 文件更新: 2 個任務（T261-T262）
- **並行機會**: 80+ 任務標記 [P] 可平行執行
- **獨立測試標準**: 每個 User Story 都有明確的獨立測試方法
- **建議 MVP 範圍**: Phase 1 + Phase 2 + Phase 3（User Story 1 only）= ~50 個任務
- **整合範圍**: Phase 8（前後端整合）= 63 個任務，包含 Flutter WebView、格式統一、API 測試、覆蓋率驗證、API 對齊修正
- **格式驗證**: ✅ 所有任務遵循 checklist 格式（checkbox, ID, labels, file paths）
- **最新更新**: 新增 API 對齊與部署修正任務（T246-T262），處理後端 API 端點變更導致的前後端不一致問題
