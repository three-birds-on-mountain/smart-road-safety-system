# Implementation Plan: 背景警示和路線規劃

**Branch**: `003-background-alerts-route-planning` | **Date**: 2025-11-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-background-alerts-route-planning/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

實作背景警示和路線規劃功能，包含三大核心能力：

1. **背景安全監控** (P1): 即使螢幕關閉或應用程式在背景運行，持續追蹤使用者位置並在接近危險路段時發出警示（震動或音效）
2. **事故數量篩選** (P2): 提供可調整的事故數量閾值（1-10），只顯示和警示達到閾值的危險路段
3. **路線安全評估** (P3): 規劃從起點到目的地的路線，計算路線經過的事故統計資訊，並在風險過高時建議使用大眾交通工具

技術方案需要解決 Web 平台的背景運行限制、高效的地理空間查詢、以及整合 Mapbox 路線規劃 API。

## Technical Context

**Language/Version**:
- Backend: Python 3.12+
- Frontend: TypeScript 5.9+ with React 19

**Primary Dependencies**:
- Backend: FastAPI, SQLAlchemy 2.0+, GeoAlchemy2, PostgreSQL/PostGIS
- Frontend: React 19, Redux Toolkit, Mapbox GL 3.16+, axios

**Storage**: PostgreSQL with PostGIS extension for geospatial data

**Testing**:
- Backend: pytest with pytest-asyncio and pytest-cov
- Frontend: Vitest with @testing-library/react

**Target Platform**: Web application (初期), NEEDS CLARIFICATION - PWA or native app for reliable background features

**Project Type**: Web application (frontend + backend separation)

**Performance Goals** (from Success Criteria):
- Background alert trigger: < 5 seconds within 200m of hotspot (SC-001)
- Battery consumption: < 10% per 2 hours of continuous background monitoring (SC-002)
- Route planning completion: < 30 seconds (SC-003)
- Route safety calculation accuracy: ≥ 95% (SC-004)
- Filter update response: < 2 seconds (SC-005)
- Route re-planning: < 10 seconds (SC-006)

**Constraints**:
- API response time: < 200ms (p95) per Constitution IV
- Background location tracking on web platform - NEEDS CLARIFICATION
- Web Vibration API and Audio API browser support - NEEDS CLARIFICATION
- Geospatial query optimization for route-accident intersection - NEEDS CLARIFICATION
- Service Worker limitations for background tasks - NEEDS CLARIFICATION

**Scale/Scope**:
- Single-user application with real-time location tracking
- Potentially thousands of concurrent geospatial queries for route planning
- Historical accident database size unknown - NEEDS CLARIFICATION
- Expected user base and concurrent users - NEEDS CLARIFICATION

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality ✓ PASS

- **Readability First**: 程式碼將使用清晰的命名和自我文件化的結構
- **SOLID Principles**: 將分離關注點（background service, geolocation, notification, route planning）
- **Type Safety**: TypeScript (frontend) 和 Python type hints (backend) 全面使用
- **Error Handling**: 所有錯誤路徑將明確處理（權限拒絕、GPS 訊號不穩定、API 失敗等）

### II. Testing Discipline ✓ PASS (with TDD commitment)

- **TDD Mandatory**: 承諾遵循 Red-Green-Refactor cycle
- **Contract Tests**: REQUIRED for Mapbox API integration, backend API endpoints
- **Integration Tests**: REQUIRED for background monitoring workflow, route planning + safety calculation
- **Unit Tests**: REQUIRED for geospatial calculations, risk scoring, filter logic
- **Coverage**: Target ≥ 80% for new code, 100% for critical path (alert trigger, route safety)
- **Test Performance**: Unit < 100ms, Integration < 5s

### III. User Experience Consistency ✓ PASS

- **Feedback**: 每個操作都有即時回饋（搜尋、路線規劃、設定變更）
- **Error Messages**: 可操作的錯誤訊息（權限拒絕時引導使用者、無法規劃路線時說明原因）
- **Loading States**: 路線規劃和地圖載入時顯示載入指示器
- **Accessibility**: 遵循 WCAG 2.1 AA（鍵盤導航、螢幕閱讀器、對比度）
- **Responsive Design**: 支援行動裝置和桌面裝置
- **Progressive Disclosure**: 核心功能優先顯示（地圖和警示），進階功能（路線規劃）漸進揭露

### IV. Performance Standards ⚠️ NEEDS REVIEW

- **Response Time**: < 100ms (perceived instant) - route planning may exceed this
- **API Latency**: p95 < 200ms ✓
- **DB Queries**: PostGIS spatial queries need optimization - use spatial indexes
- **Bundle Size**: < 500KB gzipped total, < 100KB critical path - Mapbox GL is large (~200KB), NEEDS CLARIFICATION
- **Monitoring**: Will add performance benchmarks for critical geospatial queries

**Potential Violation**:
- Route planning (SC-003: < 30s) 遠超 100ms instant response 標準
- Mapbox GL bundle size 可能超過 critical path 限制

**Justification**:
- 路線規劃是複雜的地理空間計算，30 秒是合理的使用者期望，且會顯示 loading state
- Mapbox GL 是地圖核心依賴，無法避免，但可以透過 code splitting 延遲載入

### V. Documentation Language ✓ PASS

- 所有文件（spec.md, plan.md, research.md 等）使用繁體中文 ✓
- API 文件和程式碼註解將使用繁體中文
- Commit messages 優先使用繁體中文

### Technical Standards ✓ PASS

- **Linting**: ESLint (frontend), Ruff (backend) with zero warnings
- **Formatting**: Prettier (frontend), Black (backend)
- **Python PEP 8**: Backend code follows PEP 8
- **Pre-commit Hooks**: Will add for linting, formatting, and tests
- **Documentation**: README, API docs, architecture decisions in Traditional Chinese

### Development Workflow ✓ PASS

- **Git**: Conventional Commits, branch naming, no direct commits to main
- **Code Review**: ≥ 1 approval required
- **CI**: All tests pass, builds succeed, lint/format checks, security scans
- **Feature Flags**: Incomplete features behind flags (background monitoring initially disabled)

### Summary

**Status**: ✓ CONDITIONAL PASS

**Violations**:
1. Bundle size (Mapbox GL ~200KB)
2. Route planning response time (30s >> 100ms)

**Justifications**: See Complexity Tracking section below.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   ├── user_settings.py         # 使用者警示設定 (AlertSettings)
│   │   └── route.py                 # 路線相關模型 (Route, RouteSafetySummary)
│   ├── services/
│   │   ├── background_monitor.py    # 背景監控服務 (位置追蹤 + 警示觸發)
│   │   ├── geospatial.py            # 地理空間計算 (hotspot proximity, route intersection)
│   │   ├── route_planner.py         # 路線規劃服務 (Mapbox API integration)
│   │   └── safety_calculator.py     # 安全評估服務 (risk scoring)
│   └── api/
│       ├── settings.py              # 使用者設定 API endpoints
│       ├── routes.py                # 路線規劃 API endpoints
│       └── monitoring.py            # 背景監控狀態 API endpoints
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
│   │   │   └── SearchBox.tsx        # 地址搜尋框 (單一/雙重模式)
│   │   ├── settings/
│   │   │   ├── AlertSettings.tsx    # 警示方式設定
│   │   │   └── ThresholdSlider.tsx  # 數量篩選滑桿
│   │   └── route/
│   │       └── RouteSafetySummary.tsx  # 路線安全統計 drawer
│   ├── services/
│   │   ├── backgroundMonitor.ts     # 背景監控 service (Service Worker integration)
│   │   ├── geolocation.ts           # 位置追蹤 service
│   │   ├── notification.ts          # 警示通知 service (Vibration + Audio)
│   │   └── routePlanner.ts          # 路線規劃 API client
│   ├── store/
│   │   ├── slices/
│   │   │   ├── settingsSlice.ts     # 使用者設定 state
│   │   │   ├── routeSlice.ts        # 路線規劃 state
│   │   │   └── monitoringSlice.ts   # 背景監控狀態
│   │   └── store.ts
│   └── workers/
│       └── backgroundMonitor.worker.ts  # Service Worker for background tasks
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

**Structure Decision**:

這是一個 **Web Application** 專案，採用 frontend + backend 分離架構：

- **Backend**: Python/FastAPI，負責資料模型、地理空間計算、路線規劃整合、安全評估邏輯
- **Frontend**: React/TypeScript，負責 UI 元件、使用者互動、背景監控（透過 Service Worker）、地圖顯示

**關注點分離**:
1. **Background Monitoring**: Frontend Service Worker 處理位置追蹤，Backend API 提供 hotspot 資料和警示判定邏輯
2. **Route Planning**: Frontend 負責使用者輸入和地圖顯示，Backend 整合 Mapbox API 並計算路線安全評估
3. **Settings**: Frontend 管理使用者偏好設定（Redux state），Backend 持久化儲存（如需跨裝置同步）

**測試結構**: 遵循 Contract/Integration/Unit 三層架構，確保 API 整合、端到端工作流程、以及核心業務邏輯的測試覆蓋率。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Bundle size: Mapbox GL ~200KB (超過 100KB critical path 限制) | Mapbox GL 是地圖核心功能必要依賴，提供路線顯示、地圖互動、地址搜尋等功能 | 替代方案 (Leaflet, Google Maps) 同樣需要大型 library；無地圖功能則無法滿足 User Story 3/4 路線規劃需求 |
| Route planning response time: 30s (遠超 100ms instant response 標準) | 路線規劃涉及複雜的地理空間計算：(1) Mapbox Directions API 呼叫 (2) PostGIS 查詢路線附近所有 hotspots (3) 計算交集並統計事故資料 | 預先計算所有可能路線不可行（組合爆炸）；降低精確度會影響安全評估準確性（SC-004 要求 95% 準確率） |

**Mitigation Strategies**:

1. **Bundle Size**:
   - 使用 code splitting 延遲載入 Mapbox GL（只在需要時載入）
   - 壓縮和 tree-shaking 最小化 bundle
   - 考慮 CDN caching 減少重複下載

2. **Response Time**:
   - 顯示明確的 loading state 和進度指示器
   - 實作 Progressive Loading：先顯示路線，再逐步計算事故統計
   - 後端使用 spatial indexes (PostGIS) 最佳化查詢
   - 考慮 caching 常見路線的計算結果

---

## Phase 1 後 Constitution Check 重新評估

*完成 research.md, data-model.md, contracts/, quickstart.md 後的最終評估*

### I. Code Quality ✓ PASS

**設計中的體現**:
- **Readability**: data-model.md 中的實體定義清晰，contracts/ 中的 API 命名語義化
- **SOLID**: 服務分離明確（geospatial, route_planner, safety_calculator, background_monitor）
- **Type Safety**: OpenAPI schema 定義完整的 request/response types，與 data-model 對齊
- **Error Handling**: API contracts 定義了完整的錯誤回應（400, 404, 422, 500, 503）

### II. Testing Discipline ✓ PASS

**設計中的體現**:
- **TDD Workflow**: quickstart.md 明確定義 Red-Green-Refactor 流程
- **Contract Tests**: contracts/openapi.yaml 提供完整的 API contract，quickstart 包含 Mapbox API contract test 範例
- **Integration Tests**: quickstart 包含 background monitoring 和 route planning 的整合測試範例
- **Unit Tests**: quickstart 包含 geospatial 計算、safety calculator 的單元測試範例
- **Test Structure**: plan.md 定義清楚的測試目錄結構（contract/, integration/, unit/）

### III. User Experience Consistency ✓ PASS

**設計中的體現**:
- **Feedback**: API contracts 包含 loading state endpoints，quickstart 說明 Progressive Loading
- **Error Messages**: OpenAPI 定義清楚的錯誤訊息格式和 error codes
- **Accessibility**: quickstart 提到 Web API 的跨瀏覽器支援和功能偵測
- **Consistent Patterns**: 所有 API endpoints 遵循 RESTful 規範，回應格式統一

### IV. Performance Standards ⚠️ CONDITIONAL PASS

**設計中的體現**:
- **API Latency**: OpenAPI 定義效能要求（< 200ms），quickstart 說明 GIST 索引最佳化
- **DB Queries**: data-model.md 定義完整的空間索引（GIST），research.md 證明可達 50ms 查詢時間
- **Bundle Size**: research.md 提出 code splitting 緩解策略，但 Mapbox GL 仍超過限制（已記錄於 Complexity Tracking）
- **Monitoring**: contracts 包含效能監控相關 endpoints

**仍存在的違規**（已充分緩解）:
1. Mapbox GL bundle size ~200KB
2. Route planning 最長 30s（符合 SC-003 但超過 100ms 標準）

### V. Documentation Language ✓ PASS

**設計中的體現**:
- research.md ✓ 繁體中文
- data-model.md ✓ 繁體中文
- contracts/README.md ✓ 繁體中文
- contracts/openapi.yaml ✓ 繁體中文（descriptions, summaries）
- quickstart.md ✓ 繁體中文
- plan.md ✓ 繁體中文

### Technical Standards ✓ PASS

**設計中的體現**:
- **Linting**: quickstart 說明 ESLint/Ruff 使用
- **Formatting**: quickstart 說明 Prettier/Black 使用
- **Python PEP 8**: quickstart 範例程式碼遵循 PEP 8
- **Documentation**: 所有文件完整且使用繁體中文
- **Dependency Management**: research.md 記錄所有第三方依賴的選擇理由

### Development Workflow ✓ PASS

**設計中的體現**:
- **Git**: 已在正確的 feature branch (003-background-alerts-route-planning)
- **Testing**: quickstart 定義完整的測試執行指令和覆蓋率要求
- **CI**: quickstart 提到 OpenAPI 規格驗證應整合進 CI
- **Feature Flags**: plan.md 提到背景監控功能初期可能需要 feature flag

---

## 最終評估結果

**Status**: ✅ **PASS** (with documented exceptions)

**已完成的 Phase 1 產出**:
- ✅ research.md (664 lines) - 完整的技術研究和決策記錄
- ✅ data-model.md - 6 個實體定義，包含完整的 SQL DDL
- ✅ contracts/openapi.yaml - 11 個 API endpoints 的完整規格
- ✅ contracts/README.md - API 使用指南
- ✅ quickstart.md - 開發者快速開始指南，包含 TDD 流程和程式碼範例

**Constitution 遵循度**: 5/5 核心原則 PASS

**違規項目**: 2 項（Bundle size, Response time），均已在 Complexity Tracking 中充分說明理由和緩解策略

**下一步**: 準備執行 `/speckit.tasks` 產生 tasks.md（Phase 2）
