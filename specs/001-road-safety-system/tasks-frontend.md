# Tasks (Frontend): 智慧道路守護系統

**範圍**: 前端應用開發任務（React + Vite + Mapbox GL JS）
**路徑**: `frontend/src/`, `frontend/tests/`
**完整任務清單**: 參見 [tasks.md](tasks.md)

本文件僅列出前端相關任務，方便前端開發者專注執行。

## ⚠️ 重要：UI 設計規範

**所有 UI 相關任務都必須嚴格遵守 Town Pass Design System**

- **Design System 文件**: `specs/design-system/`
  - 主入口：`specs/design-system/showcase.html`（色彩、字體、間距、元件）
  - 圖標系統：`specs/design-system/icons/index.html`（95+ 圖標）
  - 說明文件：`specs/design-system/README.md`

### UI 實作原則

1. **使用 CSS 變數**：不要寫死色碼，使用 `var(--primary-500)` 等 design tokens
2. **遵循間距系統**：使用 `var(--space-md)` 等預定義間距
3. **使用設計系統圖標**：從 `icons/index.html` 選擇圖標，不要自己畫
4. **語意化命名**：使用 `.btn-primary` 而非 `.blue-button`
5. **保持一致性**：確保圓角、陰影、字體都使用設計系統定義的值

### 受影響的任務

以下任務在實作時必須參考 Design System：

- **T029**: 配置 Tailwind CSS（需整合 Design System 的色彩與間距 tokens）
- **T030**: 基礎佈局元件（需使用 Design System 的佈局規範）
- **T045-T046**: AlertOverlay 與 AlertIcon（需使用 Design System 的警示色彩與圖標）
- **T056-T059**: 設定元件（需使用 Design System 的表單元件樣式）
- **T060**: SettingsPage（需使用 Design System 的卡片與按鈕樣式）
- **T082-T084**: 地圖元件（需使用 Design System 的圖標與色彩）
- **T087**: HotspotDetailPopup（需使用 Design System 的彈窗樣式）
- **T091**: 載入指示器（需使用 Design System 的 spinner 樣式）
- **T119-T120**: 錯誤提示與警告訊息（需使用 Design System 的 Alert 元件）

---

## Phase 1: Setup (Frontend)

- [x] T001 根據 plan.md 建立專案目錄結構（frontend/）
- [x] T003 [P] 初始化前端專案：建立 frontend/package.json 並安裝 React, Vite, Tailwind, Redux Toolkit, Mapbox GL JS
- [x] T005 [P] 配置前端 linting 工具：設定 ESLint, Prettier 於 frontend/.eslintrc.json 與 frontend/.prettierrc
- [x] T006 建立 Docker Compose 配置：docker-compose.yml（frontend 開發伺服器）
- [x] T008 [P] 建立前端環境變數範本：frontend/.env.example（VITE_API_BASE_URL, VITE_MAPBOX_ACCESS_TOKEN）

---

## Phase 2: Foundational (Frontend)

### 前端基礎設定

- [x] T025 設定 Redux Store：frontend/src/store/index.ts（store 配置與 middleware）
- [x] T026 [P] 建立 Redux slices 骨架：frontend/src/store/hotspotsSlice.ts, frontend/src/store/settingsSlice.ts, frontend/src/store/locationSlice.ts
- [x] T027 [P] 建立 API 客戶端：frontend/src/services/api.ts（Axios instance, base URL 設定）
- [x] T028 [P] 建立型別定義：frontend/src/types/accident.ts, frontend/src/types/hotspot.ts, frontend/src/types/settings.ts
- [x] T029 配置 Tailwind CSS：frontend/tailwind.config.js（主題色彩、中文字型）
- [x] T030 建立基礎佈局元件：frontend/src/App.tsx（路由設定）

---

## Phase 3: User Story 1 - 即時危險區域警示 (Frontend)

### Tests

- [x] T034 [P] [US1] Integration test for GPS定位與警示觸發 in frontend/tests/integration/test_alert_trigger.spec.ts
- [x] T035 [P] [US1] Unit test for AlertService in frontend/tests/unit/test_alert_service.spec.ts

### Implementation: GPS 定位與警示系統

- [x] T041 [P] [US1] 建立 Geolocation Service in frontend/src/services/geolocation.ts（watchPosition API, 錯誤處理）
- [x] T042 [P] [US1] 建立 Alert Service in frontend/src/services/alerts.ts（音效播放、Vibration API、距離判斷邏輯）
- [x] T043 [US1] 實作 locationSlice actions in frontend/src/store/locationSlice.ts（updateLocation, setGPSStatus）
- [x] T044 [US1] 實作 hotspotsSlice actions in frontend/src/store/hotspotsSlice.ts（fetchNearbyHotspots thunk, updateNearbyList）
- [x] T045 [P] [US1] 建立 AlertOverlay 元件 in frontend/src/components/Alert/AlertOverlay.tsx（視覺警示、熱點資訊顯示）
- [x] T046 [P] [US1] 建立 AlertIcon 元件 in frontend/src/components/Alert/AlertIcon.tsx（不同嚴重程度的圖示）
- [x] T047 [US1] 整合 Geolocation 與 Alert 邏輯 in frontend/src/pages/MapPage.tsx（GPS 更新→查詢熱點→觸發警示）
- [x] T048 [US1] 實作警示間隔控制（最小30秒）in frontend/src/services/alerts.ts（防止連續重複警示）

### Verification

- [ ] T050 [US1] 手動測試：使用模擬GPS工具驗證警示觸發

---

## Phase 4: User Story 2 - 客製化警示設定 (Frontend)

### Tests

- [ ] T051 [P] [US2] Unit test for DistanceSelector in frontend/tests/unit/components/test_distance_selector.spec.ts
- [ ] T052 [P] [US2] Unit test for AccidentLevelFilter in frontend/tests/unit/components/test_accident_level_filter.spec.ts
- [ ] T053 [P] [US2] Unit test for TimeRangeFilter in frontend/tests/unit/components/test_time_range_filter.spec.ts
- [ ] T054 [P] [US2] Unit test for AlertModeSelector in frontend/tests/unit/components/test_alert_mode_selector.spec.ts
- [ ] T055 [P] [US2] Integration test for 設定變更立即生效 in frontend/tests/integration/test_settings_flow.spec.ts

### Implementation: 設定介面

- [ ] T056 [P] [US2] 建立 DistanceSelector 元件 in frontend/src/components/Settings/DistanceSelector.tsx
- [ ] T057 [P] [US2] 建立 AccidentLevelFilter 元件 in frontend/src/components/Settings/AccidentLevelFilter.tsx
- [ ] T058 [P] [US2] 建立 TimeRangeFilter 元件 in frontend/src/components/Settings/TimeRangeFilter.tsx
- [ ] T059 [P] [US2] 建立 AlertModeSelector 元件 in frontend/src/components/Settings/AlertModeSelector.tsx
- [ ] T060 [US2] 整合設定頁面 in frontend/src/pages/SettingsPage.tsx（佈局、儲存按鈕）
- [ ] T061 [US2] 實作 settingsSlice actions in frontend/src/store/settingsSlice.ts
- [ ] T062 [US2] 實作本地儲存持久化 in frontend/src/store/settingsSlice.ts（localStorage sync）

### Implementation: 設定驅動的篩選邏輯

- [ ] T063 [US2] 修改 fetchNearbyHotspots thunk in frontend/src/store/hotspotsSlice.ts（讀取 settingsSlice 狀態）
- [ ] T064 [US2] 修改 Alert Service in frontend/src/services/alerts.ts（根據 alertModes 設定觸發）
- [ ] T065 [US2] 實作「不提醒」模式的視覺提示 in frontend/src/components/Alert/AlertOverlay.tsx
- [ ] T066 [US2] 實作多重警示方式組合 in frontend/src/services/alerts.ts（音效+震動）

### Verification

- [ ] T071 [US2] 手動測試：切換不同設定組合，驗證警示行為

---

## Phase 5: User Story 3 - 地圖視覺化熱點資訊 (Frontend)

### Tests

- [ ] T075 [P] [US3] Integration test for 地圖互動 in frontend/tests/integration/test_map_interaction.spec.ts
- [ ] T076 [P] [US3] Unit test for HotspotLayer in frontend/tests/unit/components/test_hotspot_layer.spec.ts

### Implementation: Mapbox 地圖整合

- [ ] T082 [P] [US3] 建立 MapView 元件 in frontend/src/components/Map/MapView.tsx（Mapbox GL JS 初始化）
- [ ] T083 [P] [US3] 建立 HotspotLayer 元件 in frontend/src/components/Map/HotspotLayer.tsx（Circle layer 渲染）
- [ ] T084 [P] [US3] 建立 UserLocation 元件 in frontend/src/components/Map/UserLocation.tsx（顯示用戶位置標記）
- [ ] T085 [US3] 實作熱點資料載入邏輯 in frontend/src/store/hotspotsSlice.ts（fetchHotspotsInBounds thunk）
- [ ] T086 [US3] 實作地圖事件監聽 in frontend/src/components/Map/MapView.tsx（moveend, zoomend）
- [ ] T087 [US3] 建立熱點詳細資訊彈窗 in frontend/src/components/Map/HotspotDetailPopup.tsx
- [ ] T088 [US3] 實作點擊熱點標記觸發彈窗 in frontend/src/components/Map/MapView.tsx

### 地圖視覺化優化

- [ ] T089 [US3] 實作熱點顏色映射邏輯 in frontend/src/components/Map/HotspotLayer.tsx（A1: 紅色、A2: 橙色、A3: 黃色）
- [ ] T090 [US3] 實作熱點聚合顯示 in frontend/src/components/Map/HotspotLayer.tsx（縮小時聚合、放大時展開）
- [ ] T091 [US3] 加入載入指示器 in frontend/src/components/Map/MapView.tsx（spinner）

### Verification

- [ ] T093 [US3] 手動測試：在地圖上移動、縮放、點擊標記

---

## Phase 7: Polish & Cross-Cutting (Frontend)

### 效能優化

- [ ] T117 [P] 前端效能優化：實作 Code Splitting in frontend/vite.config.ts（Mapbox SDK lazy loading）
- [ ] T122 [P] 實作地圖熱點過多聚合邏輯 in frontend/src/components/Map/HotspotLayer.tsx（超過 500 個熱點只顯示高優先級）

### 錯誤處理

- [ ] T119 [P] 實作 GPS 訊號弱處理 in frontend/src/services/geolocation.ts（顯示警告訊息）
- [ ] T120 [P] 實作資料更新中提示 in frontend/src/pages/MapPage.tsx（顯示「資料更新中」）

### 測試與文件

- [ ] T126 [P] 執行前端測試覆蓋率檢查：npm run test:coverage（目標 ≥ 80%）
- [ ] T127 驗證 quickstart.md 所有步驟可執行

### 安全性

- [ ] T130 [P] 前端環境變數驗證 in frontend/src/main.tsx（VITE_API_BASE_URL, VITE_MAPBOX_ACCESS_TOKEN 必填檢查）

### CI/CD

- [ ] T132 [P] 建立前端 CI workflow in .github/workflows/frontend-ci.yml（npm test, npm run lint）

---

## Frontend Task Summary

- **總前端任務數**: 54 個任務
- **分布**:
  - Setup: 5 個任務
  - Foundational: 6 個任務
  - User Story 1: 10 個任務
  - User Story 2: 16 個任務
  - User Story 3: 13 個任務
  - Polish: 4 個任務

---

## Execution Order (Frontend Only)

1. **Phase 1: Setup** (T001, T003, T005, T006, T008) → 建立專案結構
2. **Phase 2: Foundational** (T025-T030) → 等待後端 API 框架完成（T021）後可開始
3. **Phase 3-5: User Stories** (可並行或依優先順序)
   - US1 (T034-T050) → 等待後端 API T036-T040 完成後開始整合
   - US2 (T051-T071) → 可與 US1 並行開發元件
   - US3 (T075-T093) → 等待後端 API T077-T081 完成後開始整合
4. **Phase 7: Polish** (T117-T132) → 最後完善

---

## Parallel Opportunities (Frontend)

- T026, T027, T028（Redux/API/Types setup）可並行
- T041, T042, T045, T046（US1 Services 與元件）可並行
- T056, T057, T058, T059（US2 設定元件）可並行
- T082, T083, T084（US3 地圖元件）可並行

---

## Dependencies on Backend

前端任務依賴以下後端 API 完成：

- **US1**: 需要 `GET /api/v1/hotspots/nearby` (T036-T040)
- **US2**: 需要後端支援 time_range 與 severity_levels 參數 (T067-T069)
- **US3**: 需要 `GET /api/v1/hotspots/in-bounds` 與 `GET /api/v1/hotspots/{hotspot_id}` (T077-T081)

建議後端優先完成 Foundational Phase (T009-T024)，讓前端可以開始開發元件，再依序提供各 User Story 的 API。

---

## Notes

- 標記 **[P]** 的任務可平行執行
- 標記 **[US1/US2/US3]** 的任務屬於特定 User Story
- **TDD 建議**: 前端測試可用 Vitest + React Testing Library
- 完整專案脈絡請參閱 [tasks.md](tasks.md)
- 前後端整合測試建議在 User Story 完成後執行
