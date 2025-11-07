# 前後端格式映射規則

**功能**: [spec.md](../spec.md) | **API 契約**: [openapi.yaml](openapi.yaml) | **日期**: 2025-11-07

## 概述

本文件定義前端與後端之間的資料格式轉換規則，確保前後端整合的一致性。

---

## 1. 時間範圍 (Time Range)

### 格式對照表

| 中文描述 | 前端格式 (TypeScript) | 後端 API 格式 | 說明 |
|---------|----------------------|--------------|------|
| 一年內 | `'1Y'` | `'1_year'` | 過去 365 天 |
| 半年內 | `'6M'` | `'6_months'` | 過去 180 天 |
| 三個月內 | `'3M'` | `'3_months'` | 過去 90 天 |
| 一個月內 | `'1M'` | `'1_month'` | 過去 30 天 |

### 前端實作

前端需實作轉換函式：

```typescript
// frontend/src/services/api.ts 或 frontend/src/utils/mappers.ts
export function mapTimeRangeToApi(
  timeRange: '1Y' | '6M' | '3M' | '1M'
): '1_year' | '6_months' | '3_months' | '1_month' {
  const mapping = {
    '1Y': '1_year',
    '6M': '6_months',
    '3M': '3_months',
    '1M': '1_month',
  } as const;
  return mapping[timeRange];
}
```

---

## 2. 警示方式 (Alert Channel)

### 格式對照表

| 中文描述 | 前端格式 | 說明 |
|---------|---------|------|
| 音效 | `'sound'` | 播放警示音效 |
| 震動 | `'vibration'` | 觸發裝置震動 |
| 不提醒 | `[]` (空陣列) | 不發出聲音/震動，僅顯示視覺提示 |
| 音效+震動 | `['sound', 'vibration']` | 同時觸發兩種警示 |

### 說明

- **僅前端處理**：警示方式不透過 API 傳遞，僅存在於前端 localStorage
- **視覺提示**：無論警示方式為何，進入熱點時都會在螢幕上顯示警示圖示

---

## 3. 提醒距離 (Alert Distance)

### 格式對照表

| 中文描述 | 前端/後端格式 | 單位 |
|---------|--------------|-----|
| 100 公尺 | `100` | 公尺 (meters) |
| 500 公尺 | `500` | 公尺 (meters) |
| 1 公里 | `1000` | 公尺 (meters) |
| 3 公里 | `3000` | 公尺 (meters) |

### 驗證規則

- **前端與後端格式一致**，無需轉換
- **後端驗證**：僅接受 `[100, 500, 1000, 3000]`，其他值回傳 422 錯誤
- **API 參數名稱**：`distance` (query parameter)

---

## 4. 事故等級 (Accident Severity)

### 格式對照表

| 中文描述 | 前端格式 | 後端 API 格式 | 說明 |
|---------|---------|--------------|------|
| 死亡事故 | `'A1'` | `'A1'` | A1 類事故 |
| 受傷事故 | `'A2'` | `'A2'` | A2 類事故 |
| 財損事故 | `'A3'` | `'A3'` | A3 類事故 |
| 多選 | `['A1', 'A2']` | `'A1,A2'` (逗號分隔字串) | 前端陣列需轉為字串 |

### 前端實作

```typescript
// frontend/src/services/api.ts 或 frontend/src/utils/mappers.ts
export function mapSeverityLevelsToApi(
  levels: Array<'A1' | 'A2' | 'A3'>
): string | undefined {
  if (levels.length === 0 || levels.length === 3) {
    return undefined; // 不傳送參數，後端預設為全部
  }
  return levels.join(','); // 例如: 'A1,A2'
}
```

---

## 5. API 端點整合檢查清單

### GET `/api/v1/hotspots/nearby`

**前端需傳送**：
- ✅ `latitude`: number (21.5-25.5)
- ✅ `longitude`: number (119.5-122.5)
- ✅ `distance`: 100 | 500 | 1000 | 3000
- ✅ `time_range`: '1_year' | '6_months' | '3_months' | '1_month' (使用 `mapTimeRangeToApi()` 轉換)
- ✅ `severity_levels`: 'A1,A2,A3' 或 undefined (使用 `mapSeverityLevelsToApi()` 轉換)

**前端接收**：
```typescript
{
  data: Array<{
    id: string;
    center_latitude: number;
    center_longitude: number;
    radius_meters: number;
    total_accidents: number;
    a1_count: number;
    a2_count: number;
    a3_count: number;
    earliest_accident_at: string; // ISO 8601
    latest_accident_at: string; // ISO 8601
    distance_from_user_meters: number;
    severity_score: number;
  }>;
  meta: {
    total_count: number;
    user_location: { latitude: number; longitude: number };
    query_radius_meters: number;
  };
}
```

### GET `/api/v1/hotspots/in-bounds`

**前端需傳送**：
- ✅ `sw_lat`: number
- ✅ `sw_lng`: number
- ✅ `ne_lat`: number
- ✅ `ne_lng`: number
- ✅ `time_range`: (使用 `mapTimeRangeToApi()` 轉換)
- ✅ `severity_levels`: (使用 `mapSeverityLevelsToApi()` 轉換)
- ✅ `limit`: number (預設 500)

### GET `/api/v1/hotspots/{hotspot_id}`

**前端需傳送**：
- ✅ `hotspot_id`: UUID 字串 (path parameter)
- ✅ `include_accidents`: boolean (預設 false)

---

## 6. 整合任務清單

### 前端任務

- [ ] 實作 `mapTimeRangeToApi()` 轉換函式
- [ ] 實作 `mapSeverityLevelsToApi()` 轉換函式
- [ ] 檢查 `frontend/src/services/api.ts` 中的 API 呼叫是否使用轉換函式
- [ ] 驗證前端 TypeScript 型別定義與 OpenAPI 契約一致
- [ ] 撰寫單元測試驗證轉換函式的正確性

### 後端任務

- [ ] 驗證 `distance` 參數僅接受 `[100, 500, 1000, 3000]`
- [ ] 驗證 `time_range` 參數僅接受 `['1_month', '3_months', '6_months', '1_year']`
- [ ] 驗證 `severity_levels` 參數符合格式 `^(A1|A2|A3)(,(A1|A2|A3))*$`
- [ ] 確保錯誤回應使用繁體中文訊息

### 整合測試

- [ ] 建立前後端整合測試驗證格式轉換
- [ ] 測試各種參數組合的正確性
- [ ] 測試無效參數的錯誤處理

---

## 變更記錄

| 日期 | 版本 | 變更內容 |
|-----|------|---------|
| 2025-11-07 | 1.0.0 | 初始版本，定義時間範圍、警示方式、距離、事故等級的格式映射 |
