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

## Phase 2: US2 - 路線規劃與事故統計（純前端實作）

**架構說明**：
- 前端直接呼叫 Mapbox Directions API 取得路線
- 前端使用 Turf.js 計算路線附近的事故（已從 /hotspots/all 取得）
- 前端加總事故數量並判斷 > 200（「建議搭乘大眾交通工具」）或 ≤ 200（「安全出遊」）
- 不需要後端支援（利用現有的 /hotspots/all API 和前端篩選邏輯）

### 前端任務
- [x] T007 [P] [US2] 建立 route Redux slice - frontend/src/store/routeSlice.ts
- [x] T008 [P] [US2] 實作 Mapbox API 客戶端 - frontend/src/services/mapboxApi.ts
- [x] T009 [P] [US2] 實作路線事故計算工具 - frontend/src/utils/routeAccidentCalculator.ts
- [x] T010 [P] [US2] 實作搜尋框元件 - frontend/src/components/RouteSearch/SearchInput.tsx
- [x] T011 [P] [US2] 實作路線圖層元件 - frontend/src/components/Map/RouteLayer.tsx
- [x] T012 [P] [US2] 實作路線統計抽屜元件 - frontend/src/components/RouteDisplay/RouteSummary.tsx
- [x] T013 [US2] 整合搜尋框到地圖頁面 - frontend/src/pages/MapPage.tsx
- [x] T014 [US2] 整合路線圖層到地圖頁面 - frontend/src/pages/MapPage.tsx

---

## Phase 3: US3 - 彈性路線調整 ✅ 完成

- [x] T022 [P] [US3] 實作雙搜尋框元件 - frontend/src/components/RouteSearch/DualSearchBox.tsx
- [x] T023 [US3] 更新搜尋流程邏輯 - frontend/src/components/RouteSearch/SearchContainer.tsx

---

## 核心算法

```python
def calculate_safety_advice(total_accidents: int) -> str:
    if total_accidents > 200:
        return "建議搭乘大眾交通工具"
    else:
        return "安全出遊"
```

**總任務數**: 14 個（簡化版）
**MVP**: Phase 1 + Phase 2（約 3-5 天）
