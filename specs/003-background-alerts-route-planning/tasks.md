# 任務清單：路線規劃與事故篩選（極簡版）

**功能**: 003-background-alerts-route-planning
**簡化需求**: 直接加總事故數量，>200 危險 ≤200 安全

---

## Phase 1: US1 - 數量篩選 ✅ 完成

### 前端任務
- [x] T001 [P] [US1] 建立數量篩選 Redux slice - frontend/src/store/settingsSlice.ts
- [x] T002 [P] [US1] 實作數量篩選滑桿元件 - frontend/src/components/Settings/ThresholdSlider.tsx
- [x] T003 [US1] 整合滑桿到設定頁面 - frontend/src/pages/SettingsPage.tsx
- [x] T004 [US1] 更新地圖元件支援數量篩選 - frontend/src/utils/hotspotFilters.ts + frontend/src/pages/MapPage.tsx

### 後端任務
- [x] T005 [P] [US1] 更新 hotspots API 支援 threshold 參數 - 不需要（前端過濾）
- [x] T006 [US1] 更新 hotspot service 支援篩選 - 不需要（前端過濾）

---

## Phase 2: US2 - 路線規劃與事故統計

### 後端資料模型
- [ ] T007 [P] [US2] 建立 Route 模型 - backend/src/models/route.py
- [ ] T008 [P] [US2] 建立 RouteSummary 模型 - backend/src/models/route_summary.py
- [ ] T009 [US2] 建立資料庫遷移腳本 - backend/alembic/versions/xxx_add_route_tables.py

### 後端服務層
- [ ] T010 [P] [US2] 實作 Mapbox 客戶端 - backend/src/utils/mapbox_client.py
- [ ] T011 [P] [US2] 實作路線事故查詢服務 - backend/src/services/route_accident_service.py
- [ ] T012 [US2] 實作事故統計服務（加總，>200 危險）- backend/src/services/accident_count_service.py
- [ ] T013 [US2] 整合路線規劃服務 - backend/src/services/route_service.py

### 後端 API
- [ ] T014 [US2] 實作 POST /api/v1/routes/plan 端點 - backend/src/api/routes.py

### 前端
- [ ] T015 [P] [US2] 建立 route Redux slice - frontend/src/store/routeSlice.ts
- [ ] T016 [P] [US2] 實作 route API 客戶端 - frontend/src/services/routeApi.ts
- [ ] T017 [P] [US2] 實作搜尋框元件 - frontend/src/components/RouteSearch/SearchInput.tsx
- [ ] T018 [P] [US2] 實作路線圖層元件 - frontend/src/components/Map/RouteLayer.tsx
- [ ] T019 [P] [US2] 實作路線統計抽屜元件 - frontend/src/components/RouteDisplay/RouteSummary.tsx
- [ ] T020 [US2] 整合搜尋框到地圖頁面 - frontend/src/pages/MapPage.tsx
- [ ] T021 [US2] 整合路線圖層到地圖頁面 - frontend/src/components/Map/MapView.tsx

---

## Phase 3: US3 - 彈性路線調整

- [ ] T022 [P] [US3] 實作雙搜尋框元件 - frontend/src/components/RouteSearch/DualSearchBox.tsx
- [ ] T023 [US3] 更新搜尋流程邏輯 - frontend/src/components/RouteSearch/SearchContainer.tsx

---

## 核心算法

```python
def calculate_safety_advice(total_accidents: int) -> str:
    if total_accidents > 200:
        return "建議搭乘大眾交通工具"
    else:
        return "安全出遊"
```

**總任務數**: 23 個
**MVP**: Phase 1 + Phase 2（約 8-10 天）
