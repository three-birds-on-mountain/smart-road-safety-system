# 開發順序建議：智慧道路守護系統

**功能**: [spec.md](spec.md) | **任務清單**: [tasks.md](tasks.md)
**日期**: 2025-11-02

## 概述

本文件提供智慧道路守護系統的開發順序建議，協助團隊有效率地完成專案。

**關鍵原則**:
- ✅ **MVP優先**: 先完成 User Story 1（即時警示功能）
- ✅ **TDD強制**: 所有功能先寫測試，確認FAIL後再實作
- ✅ **獨立交付**: 每個User Story可獨立測試與部署
- ✅ **並行開發**: 充分利用標記[P]的任務加速進度

---

## 🎯 MVP 開發路徑（最小可行產品）

**目標**: 交付核心功能 - 用戶接近事故熱點時發出警示

**預估時間**: 2-3週（1位全端開發者）或 1-2週（前後端各1位）

### 階段一：Setup（1-2天）

**目標**: 建立專案基礎結構

```bash
# 任務清單（8個任務）
- [ ] T001 建立專案目錄結構
- [ ] T002 初始化後端專案（FastAPI + uv）
- [ ] T003 [P] 初始化前端專案（React + Vite）
- [ ] T004 [P] 配置後端 linting（Black, Ruff）
- [ ] T005 [P] 配置前端 linting（ESLint, Prettier）
- [ ] T006 建立 Docker Compose 配置
- [ ] T007 [P] 建立後端環境變數範本
- [ ] T008 [P] 建立前端環境變數範本
```

**並行建議**:
- T003, T004, T005, T007, T008 可同時執行

**驗收標準**:
- ✅ `docker-compose up` 成功啟動 PostgreSQL + PostGIS
- ✅ 後端執行 `uv run uvicorn src.main:app --reload` 無錯誤
- ✅ 前端執行 `npm run dev` 成功啟動

---

### 階段二：Foundational（3-5天）⚠️ CRITICAL

**目標**: 建立核心基礎設施（資料庫、API框架、Redux）

**⚠️ 重要**: 此階段**必須完成**才能開始任何User Story

```bash
# 後端任務（16個）
資料庫與ORM:
- [ ] T009 設定 PostgreSQL + PostGIS 資料庫
- [ ] T010 初始化 Alembic migrations
- [ ] T011 建立基礎 Enum 型別
- [ ] T012 [P] 建立 Accident 模型
- [ ] T013 [P] 建立 Hotspot 模型
- [ ] T014 產生初始資料庫 migration
- [ ] T015 測試資料庫遷移

API 框架:
- [ ] T016 建立 FastAPI 應用程式主檔
- [ ] T017 [P] 建立 API 路由結構
- [ ] T018 [P] 建立核心設定模組
- [ ] T019 [P] 建立錯誤處理中介層
- [ ] T020 [P] 建立日誌設定
- [ ] T021 實作健康檢查端點

服務層:
- [ ] T022 [P] 建立 Geocoding Service 骨架
- [ ] T023 [P] 建立 Data Ingestion Service 骨架
- [ ] T024 [P] 建立 Hotspot Analysis Service 骨架

# 前端任務（6個）
- [ ] T025 設定 Redux Store
- [ ] T026 [P] 建立 Redux slices 骨架
- [ ] T027 [P] 建立 API 客戶端
- [ ] T028 [P] 建立型別定義
- [ ] T029 配置 Tailwind CSS
- [ ] T030 建立基礎佈局元件
```

**並行建議**:

**後端**:
- T012 + T013（Models）可並行
- T017 + T018 + T019 + T020（API setup）可並行
- T022 + T023 + T024（Service骨架）可並行

**前端**:
- T026 + T027 + T028（Redux/API/Types）可並行

**前後端分工**:
1. **Day 1-2**: 後端完成資料庫設定（T009-T015）
2. **Day 2-3**: 後端完成API框架（T016-T021），前端可同時開始（T025-T030）
3. **Day 3**: 後端完成Service骨架（T022-T024）

**驗收標準**:
- ✅ 執行 `alembic upgrade head` 成功建立資料表
- ✅ GET `http://localhost:8000/health` 回傳 `{"status": "healthy"}`
- ✅ 前端 Redux DevTools 可看到 store 結構
- ✅ 所有 linting 工具執行無錯誤

**Checkpoint**: 🚦 **基礎就緒 - User Story 開發現在可以開始**

---

### 階段三：User Story 1 - 即時危險區域警示（5-7天）🎯 MVP

**目標**: 完成核心功能 - GPS定位 + 熱點查詢 + 警示觸發

#### 3.1 TDD Red Phase - 寫測試（1天）

```bash
# 後端測試（3個任務，可並行）
- [ ] T031 [P] [US1] Contract test for GET /api/v1/hotspots/nearby
- [ ] T032 [P] [US1] Integration test for 熱點查詢流程
- [ ] T033 [P] [US1] Unit test for 距離計算邏輯

# 前端測試（2個任務，可並行）
- [ ] T034 [P] [US1] Integration test for GPS定位與警示觸發
- [ ] T035 [P] [US1] Unit test for AlertService
```

**執行**: 所有測試應該 **FAIL**（因為功能尚未實作）

**驗收標準**:
- ✅ 執行 `pytest backend/tests/ -k US1` → 5個測試全部FAIL
- ✅ 執行 `npm test -- US1` → 2個測試全部FAIL

---

#### 3.2 後端實作 - 熱點查詢API（2-3天）

```bash
# API 實作（5個任務）
- [ ] T036 [P] [US1] 實作 GET /api/v1/hotspots/nearby 路由
- [ ] T037 [US1] 實作 HotspotService.get_nearby()
- [ ] T038 [US1] 實作距離計算與排序邏輯
- [ ] T039 [US1] 加入錯誤處理（經緯度範圍驗證）
- [ ] T040 [US1] 加入日誌記錄
```

**開發順序**:
1. T036（路由）→ T037（Service）→ T038（距離計算）
2. T039, T040 可在完成核心邏輯後並行加入

**驗收標準**:
- ✅ 執行 `pytest backend/tests/ -k US1` → 3個後端測試全部PASS
- ✅ 手動測試API:
  ```bash
  curl "http://localhost:8000/api/v1/hotspots/nearby?latitude=25.0330&longitude=121.5654&distance=1000"
  ```
  回傳有效的熱點列表JSON

---

#### 3.3 前端實作 - GPS與警示系統（2-3天）

```bash
# 服務層 & 元件（8個任務）
- [ ] T041 [P] [US1] 建立 Geolocation Service
- [ ] T042 [P] [US1] 建立 Alert Service
- [ ] T043 [US1] 實作 locationSlice actions
- [ ] T044 [US1] 實作 hotspotsSlice actions
- [ ] T045 [P] [US1] 建立 AlertOverlay 元件
- [ ] T046 [P] [US1] 建立 AlertIcon 元件
- [ ] T047 [US1] 整合 Geolocation 與 Alert 邏輯
- [ ] T048 [US1] 實作警示間隔控制（30秒）
```

**並行建議**:
- T041 + T042（Services）可並行
- T045 + T046（元件）可並行

**開發順序**:
1. **Day 1**: T041, T042（服務層）→ T043, T044（Redux）
2. **Day 2**: T045, T046（元件）→ T047（整合）
3. **Day 3**: T048（優化）+ 除錯

**驗收標準**:
- ✅ 執行 `npm test -- US1` → 2個前端測試全部PASS
- ✅ 開啟瀏覽器 `http://localhost:5173`
- ✅ 允許GPS定位權限
- ✅ 模擬移動到已知熱點座標，觸發警示

---

#### 3.4 整合驗證（1天）

```bash
# 驗證任務
- [ ] T049 [US1] 執行所有 US1 測試
- [ ] T050 [US1] 手動測試（使用模擬GPS工具）
```

**測試腳本**:

```bash
# 後端測試
cd backend
uv run pytest tests/ -k US1 -v

# 前端測試
cd frontend
npm test -- US1

# 整合測試
1. 啟動 docker-compose up
2. 開啟前端 http://localhost:5173
3. 使用瀏覽器開發者工具模擬GPS座標
4. 驗證警示觸發正確
```

**Checkpoint**: 🎉 **MVP完成！可展示/部署**

---

## 🚀 完整開發路徑（所有User Stories）

完成MVP後，依優先順序增量交付功能。

### 階段四：User Story 2 - 客製化警示設定（3-4天）

**目標**: 讓用戶自訂警示條件（距離、等級、時間、方式）

#### 4.1 前端實作 - 設定介面（2天）

```bash
# 測試（5個任務，可並行）
- [ ] T051 [P] [US2] Unit test for DistanceSelector
- [ ] T052 [P] [US2] Unit test for AccidentLevelFilter
- [ ] T053 [P] [US2] Unit test for TimeRangeFilter
- [ ] T054 [P] [US2] Unit test for AlertModeSelector
- [ ] T055 [P] [US2] Integration test for 設定變更立即生效

# 設定元件（4個任務，可並行）
- [ ] T056 [P] [US2] 建立 DistanceSelector 元件
- [ ] T057 [P] [US2] 建立 AccidentLevelFilter 元件
- [ ] T058 [P] [US2] 建立 TimeRangeFilter 元件
- [ ] T059 [P] [US2] 建立 AlertModeSelector 元件

# Redux 與持久化
- [ ] T060 [US2] 整合設定頁面
- [ ] T061 [US2] 實作 settingsSlice actions
- [ ] T062 [US2] 實作本地儲存持久化
```

**並行建議**: T056-T059 四個元件可同時開發

---

#### 4.2 前端實作 - 設定驅動邏輯（1天）

```bash
- [ ] T063 [US2] 修改 fetchNearbyHotspots thunk
- [ ] T064 [US2] 修改 Alert Service
- [ ] T065 [US2] 實作「不提醒」模式視覺提示
- [ ] T066 [US2] 實作多重警示方式組合
```

---

#### 4.3 後端實作 - 時間範圍篩選（0.5天）

```bash
- [ ] T067 [US2] 更新 GET /api/v1/hotspots/nearby（支援 time_range）
- [ ] T068 [US2] 實作時間範圍篩選邏輯
- [ ] T069 [US2] 加入事故等級篩選邏輯
```

---

#### 4.4 驗證（0.5天）

```bash
- [ ] T070 [US2] 執行所有 US2 測試
- [ ] T071 [US2] 手動測試不同設定組合
```

**Checkpoint**: ✅ **User Story 1 + 2 都可獨立運作**

---

### 階段五：User Story 3 - 地圖視覺化（4-5天）

**目標**: 在地圖上顯示熱點分布，提供視覺化介面

#### 5.1 後端實作 - 地圖查詢API（1天）

```bash
# 測試（3個任務，可並行）
- [ ] T072 [P] [US3] Contract test for GET /api/v1/hotspots/in-bounds
- [ ] T073 [P] [US3] Contract test for GET /api/v1/hotspots/{hotspot_id}
- [ ] T074 [P] [US3] Integration test for 地圖邊界查詢

# API 實作（5個任務）
- [ ] T077 [P] [US3] 實作 GET /api/v1/hotspots/in-bounds 路由
- [ ] T078 [US3] 實作 HotspotService.get_in_bounds()
- [ ] T079 [P] [US3] 實作 GET /api/v1/hotspots/{hotspot_id} 路由
- [ ] T080 [US3] 實作 HotspotService.get_by_id()
- [ ] T081 [US3] 實作熱點排序邏輯
```

**並行建議**: T077 + T079 兩個路由可並行

---

#### 5.2 前端實作 - Mapbox整合（2-3天）

```bash
# 測試（2個任務，可並行）
- [ ] T075 [P] [US3] Integration test for 地圖互動
- [ ] T076 [P] [US3] Unit test for HotspotLayer

# 地圖元件（3個任務，可並行）
- [ ] T082 [P] [US3] 建立 MapView 元件
- [ ] T083 [P] [US3] 建立 HotspotLayer 元件
- [ ] T084 [P] [US3] 建立 UserLocation 元件

# Redux 與事件處理
- [ ] T085 [US3] 實作熱點資料載入邏輯
- [ ] T086 [US3] 實作地圖事件監聽
- [ ] T087 [US3] 建立熱點詳細資訊彈窗
- [ ] T088 [US3] 實作點擊熱點標記觸發彈窗
```

**開發順序**:
1. **Day 1**: T082, T083, T084（基礎地圖元件）
2. **Day 2**: T085, T086（事件與資料綁定）
3. **Day 3**: T087, T088（互動功能）

---

#### 5.3 視覺化優化（1天）

```bash
- [ ] T089 [US3] 實作熱點顏色映射邏輯
- [ ] T090 [US3] 實作熱點聚合顯示
- [ ] T091 [US3] 加入載入指示器
```

---

#### 5.4 驗證（0.5天）

```bash
- [ ] T092 [US3] 執行所有 US3 測試
- [ ] T093 [US3] 手動測試地圖互動
```

**Checkpoint**: ✅ **所有3個User Stories完整整合**

---

### 階段六：資料擷取與熱點分析（5-7天）

**目標**: 實作資料管線，讓系統能自動更新事故資料與熱點

**注意**: 此階段可與User Stories並行開發（由不同開發者負責）

#### 6.1 資料擷取功能（3-4天）

```bash
# 測試（4個任務，可並行）
- [ ] T094 [P] Unit test for A1 資料擷取
- [ ] T095 [P] Unit test for A2 資料擷取
- [ ] T096 [P] Unit test for A3 資料擷取
- [ ] T097 [P] Integration test for 完整資料擷取流程

# 實作（3個任務，可並行A1+A2）
- [ ] T098 [P] 實作 A1 資料擷取
- [ ] T099 [P] 實作 A2 資料擷取
- [ ] T100 實作 A3 資料擷取（依賴 T101）
- [ ] T101 實作 Geocoding Service
- [ ] T102 實作資料去重邏輯
- [ ] T103 實作 POST /api/v1/admin/ingest 路由
- [ ] T104 加入資料擷取日誌
```

**開發順序**:
1. T098 + T099（A1/A2）並行開發
2. T101（Geocoding）→ T100（A3）
3. T102, T103, T104（整合）

---

#### 6.2 熱點分析功能（2-3天）

```bash
# 測試（3個任務，可並行）
- [ ] T105 [P] Unit test for DBSCAN 聚類
- [ ] T106 [P] Unit test for 熱點統計計算
- [ ] T107 [P] Integration test for 完整熱點分析流程

# 實作
- [ ] T108 實作 DBSCAN 聚類邏輯
- [ ] T109 實作熱點中心與半徑計算
- [ ] T110 實作事故統計計算
- [ ] T111 實作熱點資料寫入
- [ ] T112 實作 POST /api/v1/admin/analyze-hotspots 路由
- [ ] T113 加入熱點分析日誌
```

**開發順序**:
1. T108（DBSCAN）→ T109, T110（統計計算）
2. T111（寫入資料庫）
3. T112, T113（API與日誌）

---

#### 6.3 Cron設定文件（0.5天）

```bash
- [ ] T114 建立資料擷取 Cron 設定文件
- [ ] T115 建立熱點分析 Cron 設定文件
```

**Checkpoint**: ✅ **資料管線完整，系統可自主運作**

---

### 階段七：Polish & Cross-Cutting（2-3天）

**目標**: 完善系統品質，準備生產部署

#### 7.1 效能優化（1天）

```bash
- [ ] T116 [P] 後端效能優化（Redis caching）
- [ ] T117 [P] 前端效能優化（Code Splitting）
- [ ] T118 [P] 資料庫查詢優化（EXPLAIN ANALYZE）
- [ ] T121 [P] 實作多個重疊熱點處理
- [ ] T122 [P] 實作地圖熱點過多聚合邏輯
```

---

#### 7.2 錯誤處理（0.5天）

```bash
- [ ] T119 [P] 實作 GPS 訊號弱處理
- [ ] T120 [P] 實作資料更新中提示
```

---

#### 7.3 文件與測試覆蓋率（0.5天）

```bash
- [ ] T123 [P] 更新 README.md
- [ ] T124 [P] 產生 API 文件（Swagger UI 中文化）
- [ ] T125 [P] 執行後端測試覆蓋率檢查（目標 ≥ 80%）
- [ ] T126 [P] 執行前端測試覆蓋率檢查（目標 ≥ 80%）
- [ ] T127 驗證 quickstart.md 所有步驟
```

---

#### 7.4 安全性強化（0.5天）

```bash
- [ ] T128 [P] 加入 API rate limiting
- [ ] T129 [P] 實作管理端點認證（JWT）
- [ ] T130 [P] 前端環境變數驗證
```

---

#### 7.5 CI/CD設定（0.5天）

```bash
- [ ] T131 [P] 建立後端 CI workflow
- [ ] T132 [P] 建立前端 CI workflow
```

**Final Checkpoint**: 🎉 **系統完整，生產就緒！**

---

## 🔄 並行開發策略

### 單人全端開發者

**總時程**: 約 4-6 週

```
Week 1: Setup + Foundational
Week 2-3: User Story 1 (MVP)
Week 3-4: User Story 2 + 3
Week 5: 資料管線
Week 6: Polish
```

**執行順序**: 嚴格按照 Phase 1 → 7 循序執行

---

### 前後端各 1 位開發者

**總時程**: 約 3-4 週

#### Week 1: 基礎設施

```
後端（5天）:
- Day 1-2: Setup + 資料庫設定（T001-T015）
- Day 3-4: API框架（T016-T021）
- Day 5: Service骨架（T022-T024）

前端（3天，從Day 3開始）:
- Day 3-4: Setup + Redux（T003-T030）
- Day 5: 等待後端完成 /health 端點
```

#### Week 2: User Story 1 (MVP)

```
後端（3天）:
- Day 1: 寫測試（T031-T033）
- Day 2-3: 實作熱點查詢API（T036-T040）

前端（5天）:
- Day 1: 寫測試（T034-T035）
- Day 2-3: Services & Redux（T041-T044）
- Day 4: 元件（T045-T046）
- Day 5: 整合與優化（T047-T050）
```

#### Week 3: User Story 2 + 3

```
後端（2天）:
- Day 1: US2 時間範圍篩選（T067-T069）
- Day 2-3: US3 地圖查詢API（T072-T081）
- Day 4-5: 開始資料管線（T094-T104）

前端（5天）:
- Day 1-2: US2 設定介面（T051-T066）
- Day 3-5: US3 Mapbox整合（T075-T093）
```

#### Week 4: 資料管線 + Polish

```
後端（3天）:
- Day 1-3: 完成資料管線（T105-T115）
- Day 4-5: 效能優化（T116, T118, T121）

前端（2天）:
- Day 1-2: 效能優化 + 錯誤處理（T117, T119-T120, T122）
- Day 3: 測試覆蓋率（T126）

共同（2天）:
- Day 4: 文件與安全性（T123-T130）
- Day 5: CI/CD（T131-T132）+ 最終驗證
```

---

### 3人團隊（2後端 + 1前端）

**總時程**: 約 2-3 週

#### Week 1: 基礎設施 + MVP

```
後端開發者 A:
- Day 1-2: 資料庫設定（T009-T015）
- Day 3-5: US1 熱點查詢API（T031-T040）

後端開發者 B:
- Day 1-2: API框架（T016-T021）
- Day 3-5: US2/US3 API（T067-T081）

前端開發者:
- Day 1-2: Setup + Redux（T003-T030）
- Day 3-5: US1 GPS與警示（T034-T050）
```

#### Week 2: User Stories 完成

```
後端開發者 A:
- Day 1-5: 資料擷取功能（T094-T104）

後端開發者 B:
- Day 1-5: 熱點分析功能（T105-T115）

前端開發者:
- Day 1-2: US2 設定介面（T051-T071）
- Day 3-5: US3 地圖視覺化（T075-T093）
```

#### Week 3: Polish

```
後端開發者 A + B:
- 效能優化（T116, T118, T121）
- 安全性（T128-T129）
- 後端CI（T131）

前端開發者:
- 效能優化（T117, T122）
- 錯誤處理（T119-T120）
- 前端CI（T132）

共同:
- 文件完善（T123-T127）
- 最終整合測試
```

---

## ✅ 檢查點與驗收標準

### Phase 1: Setup 完成

- [ ] Docker Compose 成功啟動所有服務
- [ ] 後端 `uv run uvicorn src.main:app --reload` 啟動成功
- [ ] 前端 `npm run dev` 啟動成功
- [ ] 所有 linting 工具執行無錯誤

---

### Phase 2: Foundational 完成 ⚠️

- [ ] 資料庫遷移成功：`alembic upgrade head`
- [ ] GET `/health` 回傳 `{"status": "healthy"}`
- [ ] Swagger UI 可訪問：`http://localhost:8000/docs`
- [ ] Redux DevTools 顯示完整 store 結構
- [ ] 所有測試執行無錯誤（即使尚無測試案例）

---

### Phase 3: User Story 1 完成（MVP）🎯

**後端**:
- [ ] 所有US1後端測試通過：`pytest -k US1`
- [ ] API 手動測試成功：
  ```bash
  curl "http://localhost:8000/api/v1/hotspots/nearby?latitude=25.0330&longitude=121.5654&distance=1000"
  ```
  回傳有效JSON

**前端**:
- [ ] 所有US1前端測試通過：`npm test -- US1`
- [ ] 開啟 `http://localhost:5173` 可正常顯示
- [ ] GPS定位成功（瀏覽器請求權限）
- [ ] 模擬移動到熱點座標觸發警示（音效/震動）
- [ ] 離開熱點後警示停止

**整合**:
- [ ] 端對端流程測試成功（GPS → API查詢 → 警示觸發）
- [ ] 至少1位非開發者成功測試完整流程

**✅ MVP Milestone - 可展示/部署！**

---

### Phase 4: User Story 2 完成

- [ ] 所有US2測試通過
- [ ] 設定頁面所有選項可正常操作
- [ ] 修改設定後，警示行為立即改變
- [ ] 本地儲存持久化成功（重新整理頁面設定保留）
- [ ] 測試不同設定組合（至少5種組合）

---

### Phase 5: User Story 3 完成

- [ ] 所有US3測試通過
- [ ] 地圖正確載入並顯示熱點標記
- [ ] 移動/縮放地圖，熱點動態更新
- [ ] 點擊熱點標記，彈窗顯示詳細資訊
- [ ] 熱點顏色依嚴重程度正確映射

---

### Phase 6: 資料管線完成

**資料擷取**:
- [ ] 手動觸發A1擷取成功：`POST /api/v1/admin/ingest {"source_types": ["A1"]}`
- [ ] 手動觸發A2擷取成功（ZIP解壓縮正常）
- [ ] 手動觸發A3擷取成功（地理編碼運作）
- [ ] 資料庫 `accidents` 表有資料

**熱點分析**:
- [ ] 手動觸發熱點分析成功：`POST /api/v1/admin/analyze-hotspots`
- [ ] 資料庫 `hotspots` 表有資料
- [ ] 前端地圖可看到分析後的熱點

**排程**:
- [ ] Cron設定文件完整（包含測試指令）

---

### Phase 7: Polish 完成（生產就緒）

**效能**:
- [ ] API回應時間 p95 < 200ms
- [ ] 地圖頁面載入時間 < 2秒
- [ ] 前端 bundle size < 500KB gzipped

**測試覆蓋率**:
- [ ] 後端覆蓋率 ≥ 80%
- [ ] 前端覆蓋率 ≥ 80%

**文件**:
- [ ] README.md 完整（安裝、使用說明）
- [ ] API 文件可訪問且中文化
- [ ] quickstart.md 所有步驟可執行

**安全性**:
- [ ] API rate limiting 運作
- [ ] 管理端點需要認證
- [ ] 環境變數驗證運作

**CI/CD**:
- [ ] GitHub Actions 所有workflow通過
- [ ] Docker build 成功

**✅ Production Ready - 可正式上線！**

---

## 📊 時程估算總覽

### 單人全端開發

| 階段 | 時間 | 累計 |
|------|------|------|
| Setup | 1-2天 | 2天 |
| Foundational | 3-5天 | 7天 |
| User Story 1 (MVP) | 5-7天 | 14天 |
| User Story 2 | 3-4天 | 18天 |
| User Story 3 | 4-5天 | 23天 |
| 資料管線 | 5-7天 | 30天 |
| Polish | 2-3天 | 33天 |
| **總計** | **約 4-6 週** | - |

---

### 前後端各1位（並行）

| 階段 | 時間 | 累計 |
|------|------|------|
| Setup + Foundational | 5天 | 5天 |
| User Story 1 (MVP) | 5天 | 10天 |
| User Story 2 + 3 | 5天 | 15天 |
| 資料管線 + Polish | 5天 | 20天 |
| **總計** | **約 3-4 週** | - |

---

### 3人團隊（2後端+1前端）

| 階段 | 時間 | 累計 |
|------|------|------|
| 基礎設施 + MVP | 5天 | 5天 |
| User Stories 完成 | 5天 | 10天 |
| Polish | 3-5天 | 15天 |
| **總計** | **約 2-3 週** | - |

---

## 🎯 關鍵成功因素

1. **嚴格遵守TDD**: 所有功能先寫測試，確保品質
2. **Foundational必須完整**: 絕不跳過Phase 2任何任務
3. **MVP優先交付**: 完成US1後立即驗證與展示
4. **充分利用並行**: 所有標記[P]的任務盡可能同時執行
5. **每日驗收**: 每天結束前檢查當日任務的驗收標準
6. **持續整合**: 不要累積太多任務才整合測試

---

## 📝 每日工作流程建議

### 晨會（15分鐘）

- 檢視昨日完成的任務
- 確認今日要完成的任務（3-5個）
- 識別阻礙與風險

### 開發時段

1. **TDD循環**:
   - Red: 寫測試，確認FAIL
   - Green: 寫最少程式碼讓測試PASS
   - Refactor: 改善程式碼品質

2. **每完成一個任務**:
   - 執行相關測試
   - 執行 linting
   - Git commit（使用 Conventional Commits）

3. **每完成一個User Story**:
   - 執行完整測試套件
   - 手動端對端測試
   - 更新文件

### 收工前（15分鐘）

- 檢查今日任務是否符合驗收標準
- 更新 tasks.md 的 checkbox
- 紀錄明天要處理的事項

---

## 🔧 工具與資源

### 開發工具

- **後端**: VS Code + Python Extension
- **前端**: VS Code + TypeScript Extension
- **API測試**: Postman / Insomnia / curl
- **資料庫管理**: DBeaver / pgAdmin
- **Git**: GitLens Extension

### 參考文件

- [spec.md](spec.md) - 功能規格
- [plan.md](plan.md) - 實作計劃
- [data-model.md](data-model.md) - 資料模型
- [contracts/openapi.yaml](contracts/openapi.yaml) - API契約
- [quickstart.md](quickstart.md) - 快速開始指南
- [research.md](research.md) - 技術研究

### 測試資料

開發期間可使用模擬資料：

```python
# 模擬熱點資料（用於測試）
MOCK_HOTSPOTS = [
    {
        "center_lat": 25.0330,
        "center_lng": 121.5654,
        "radius_meters": 250,
        "total_accidents": 12,
        "a1_count": 2,
        "a2_count": 7,
        "a3_count": 3
    }
]
```

---

## 🚨 常見風險與應對

### 風險1: Foundational 階段延遲

**影響**: 阻擋所有後續開發
**應對**:
- 嚴格控制 Foundational 範圍，不加入非必要功能
- 若遇到PostGIS設定問題，優先尋求協助
- 使用Docker確保環境一致性

---

### 風險2: GPS定位在不同瀏覽器行為不一致

**影響**: User Story 1 無法在某些環境測試
**應對**:
- 優先支援 Chrome（開發階段）
- 加入瀏覽器相容性檢查
- 提供 GPS 模擬工具（開發者工具）

---

### 風險3: Google Maps API 配額不足

**影響**: A3資料地理編碼失敗
**應對**:
- 開發階段先處理 A1/A2 資料（已有經緯度）
- 實作地理編碼快取（避免重複呼叫）
- 啟用 Google Cloud 計費以提高配額

---

### 風險4: 測試覆蓋率不足

**影響**: 無法符合 Constitution 要求（≥ 80%）
**應對**:
- 嚴格執行 TDD（測試先行）
- 每日檢查覆蓋率報告
- 優先補足低覆蓋率模組的測試

---

## 📞 支援資源

### 遇到問題時

1. **技術問題**:
   - 查閱 [research.md](research.md) 的技術決策
   - 參考 [quickstart.md](quickstart.md) 的排解章節

2. **API規格問題**:
   - 查閱 [contracts/openapi.yaml](contracts/openapi.yaml)
   - 使用 Swagger UI 測試端點

3. **資料模型問題**:
   - 查閱 [data-model.md](data-model.md)
   - 檢查資料庫 schema

---

**祝開發順利！** 🚀

記住：**MVP優先，測試先行，增量交付！**
