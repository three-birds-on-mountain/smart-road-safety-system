# Tasks (Backend): 智慧道路守護系統

**範圍**: 後端 API 開發任務（FastAPI + PostgreSQL + PostGIS）
**路徑**: `backend/src/`, `backend/tests/`
**完整任務清單**: 參見 [tasks.md](tasks.md)

本文件僅列出後端相關任務，方便後端開發者專注執行。

---

## Phase 1: Setup (Backend)

- [ ] T001 根據 plan.md 建立專案目錄結構（backend/）
- [ ] T002 初始化後端專案：建立 backend/pyproject.toml 並使用 uv 安裝 FastAPI, SQLAlchemy, PostGIS 相關套件
- [ ] T004 [P] 配置後端 linting 工具：設定 Black, Ruff 於 backend/pyproject.toml
- [ ] T006 建立 Docker Compose 配置：docker-compose.yml（PostgreSQL + PostGIS + backend）
- [ ] T007 [P] 建立後端環境變數範本：backend/.env.example（DATABASE_URL, GOOGLE_MAPS_API_KEY）

---

## Phase 2: Foundational (Backend)

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

---

## Phase 3: User Story 1 - 即時危險區域警示 (Backend)

### Tests

- [ ] T031 [P] [US1] Contract test for GET /api/v1/hotspots/nearby in backend/tests/contract/test_hotspots_nearby.py
- [ ] T032 [P] [US1] Integration test for 熱點查詢流程 in backend/tests/integration/test_hotspot_query_flow.py
- [ ] T033 [P] [US1] Unit test for 距離計算邏輯 in backend/tests/unit/test_distance_calculation.py

### Implementation

- [ ] T036 [P] [US1] 實作 GET /api/v1/hotspots/nearby 路由 in backend/src/api/hotspots.py
- [ ] T037 [US1] 實作 HotspotService.get_nearby() in backend/src/services/hotspot_service.py
- [ ] T038 [US1] 實作距離計算與排序邏輯 in backend/src/services/hotspot_service.py
- [ ] T039 [US1] 加入錯誤處理：經緯度範圍驗證 in backend/src/api/hotspots.py
- [ ] T040 [US1] 加入日誌記錄 in backend/src/api/hotspots.py

### Verification

- [ ] T049 [US1] 執行所有 US1 後端測試：pytest backend/tests/ -k US1

---

## Phase 4: User Story 2 - 客製化警示設定 (Backend)

### Implementation

- [ ] T067 [US2] 更新 GET /api/v1/hotspots/nearby in backend/src/api/hotspots.py（支援 time_range 參數）
- [ ] T068 [US2] 實作時間範圍篩選邏輯 in backend/src/services/hotspot_service.py
- [ ] T069 [US2] 加入事故等級篩選邏輯 in backend/src/services/hotspot_service.py

### Verification

- [ ] T070 [US2] 執行所有 US2 後端測試

---

## Phase 5: User Story 3 - 地圖視覺化熱點資訊 (Backend)

### Tests

- [ ] T072 [P] [US3] Contract test for GET /api/v1/hotspots/in-bounds in backend/tests/contract/test_hotspots_in_bounds.py
- [ ] T073 [P] [US3] Contract test for GET /api/v1/hotspots/{hotspot_id} in backend/tests/contract/test_hotspot_detail.py
- [ ] T074 [P] [US3] Integration test for 地圖邊界查詢 in backend/tests/integration/test_map_bounds_query.py

### Implementation

- [ ] T077 [P] [US3] 實作 GET /api/v1/hotspots/in-bounds 路由 in backend/src/api/hotspots.py
- [ ] T078 [US3] 實作 HotspotService.get_in_bounds() in backend/src/services/hotspot_service.py
- [ ] T079 [P] [US3] 實作 GET /api/v1/hotspots/{hotspot_id} 路由 in backend/src/api/hotspots.py
- [ ] T080 [US3] 實作 HotspotService.get_by_id() in backend/src/services/hotspot_service.py
- [ ] T081 [US3] 實作熱點排序邏輯 in backend/src/services/hotspot_service.py

### Verification

- [ ] T092 [US3] 執行所有 US3 後端測試

---

## Phase 6: 資料擷取與熱點分析

### 資料擷取 - Tests

- [ ] T094 [P] Unit test for A1 資料擷取 in backend/tests/unit/test_data_ingestion_a1.py
- [ ] T095 [P] Unit test for A2 資料擷取 in backend/tests/unit/test_data_ingestion_a2.py
- [ ] T096 [P] Unit test for A3 資料擷取 in backend/tests/unit/test_data_ingestion_a3.py
- [ ] T097 [P] Integration test for 完整資料擷取流程 in backend/tests/integration/test_full_ingestion.py

### 資料擷取 - Implementation

- [ ] T098 [P] 實作 A1 資料擷取 in backend/src/services/data_ingestion.py
- [ ] T099 [P] 實作 A2 資料擷取 in backend/src/services/data_ingestion.py
- [ ] T100 實作 A3 資料擷取 in backend/src/services/data_ingestion.py
- [ ] T101 實作 Geocoding Service in backend/src/services/geocoding.py
- [ ] T102 實作資料去重邏輯 in backend/src/services/data_ingestion.py
- [ ] T103 實作 POST /api/v1/admin/ingest 路由 in backend/src/api/admin.py
- [ ] T104 加入資料擷取日誌 in backend/src/services/data_ingestion.py

### 熱點分析 - Tests

- [ ] T105 [P] Unit test for DBSCAN 聚類 in backend/tests/unit/test_hotspot_analysis_dbscan.py
- [ ] T106 [P] Unit test for 熱點統計計算 in backend/tests/unit/test_hotspot_stats.py
- [ ] T107 [P] Integration test for 完整熱點分析流程 in backend/tests/integration/test_full_analysis.py

### 熱點分析 - Implementation

- [ ] T108 實作 DBSCAN 聚類邏輯 in backend/src/services/hotspot_analysis.py
- [ ] T109 實作熱點中心與半徑計算 in backend/src/services/hotspot_analysis.py
- [ ] T110 實作事故統計計算 in backend/src/services/hotspot_analysis.py
- [ ] T111 實作熱點資料寫入 in backend/src/services/hotspot_analysis.py
- [ ] T112 實作 POST /api/v1/admin/analyze-hotspots 路由 in backend/src/api/admin.py
- [ ] T113 加入熱點分析日誌 in backend/src/services/hotspot_analysis.py

### Cron 設定

- [ ] T114 建立資料擷取 Cron 設定文件 in docs/cron-setup.md
- [ ] T115 建立熱點分析 Cron 設定文件 in docs/cron-setup.md

---

## Phase 7: Polish & Cross-Cutting (Backend)

### 效能優化

- [ ] T116 [P] 後端效能優化：加入 API response caching in backend/src/core/cache.py
- [ ] T118 [P] 資料庫查詢優化：驗證 PostGIS 索引 in backend/docs/performance-tuning.md
- [ ] T121 [P] 實作多個重疊熱點處理 in backend/src/services/hotspot_service.py

### 文件與測試

- [ ] T124 [P] 產生 API 文件：設定 FastAPI Swagger UI 中文化 in backend/src/main.py
- [ ] T125 [P] 執行測試覆蓋率檢查：pytest --cov=src --cov-report=html（目標 ≥ 80%）

### 安全性

- [ ] T128 [P] 加入 API rate limiting in backend/src/core/middleware.py
- [ ] T129 [P] 實作管理端點認證 in backend/src/api/admin.py

### CI/CD

- [ ] T131 [P] 建立後端 CI workflow in .github/workflows/backend-ci.yml

---

## Backend Task Summary

- **總後端任務數**: 68 個任務
- **分布**:
  - Setup: 5 個任務
  - Foundational: 16 個任務
  - User Story 1: 8 個任務
  - User Story 2: 3 個任務
  - User Story 3: 8 個任務
  - 資料管線: 22 個任務
  - Polish: 6 個任務

---

## Execution Order (Backend Only)

1. **Phase 1: Setup** (T001-T007) → 建立專案結構
2. **Phase 2: Foundational** (T009-T024) → **CRITICAL**: 必須完成才能開始 User Stories
3. **Phase 3-5: User Stories** (可並行或依優先順序)
   - US1 (T031-T049)
   - US2 (T067-T070)
   - US3 (T072-T092)
4. **Phase 6: 資料管線** (T094-T115) → 可與 US 並行
5. **Phase 7: Polish** (T116-T131) → 最後完善

---

## Parallel Opportunities (Backend)

- T012, T013（Models）可並行
- T017, T018, T019, T020（API setup）可並行
- T022, T023, T024（Service 骨架）可並行
- T031, T032, T033（US1 tests）可並行
- T094, T095, T096（資料擷取 tests）可並行
- T105, T106, T107（熱點分析 tests）可並行

---

## Notes

- 標記 **[P]** 的任務可平行執行
- 標記 **[US1/US2/US3]** 的任務屬於特定 User Story
- **TDD 強制**: 所有測試任務必須先寫並確認 FAIL
- 完整專案脈絡請參閱 [tasks.md](tasks.md)
