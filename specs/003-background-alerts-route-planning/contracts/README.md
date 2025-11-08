# API Contracts 文件

**功能**: 背景警示與路線規劃
**版本**: 1.0.0
**建立日期**: 2025-11-08
**相關文件**: [spec.md](../spec.md) | [data-model.md](../data-model.md) | [research.md](../research.md)

---

## 概述

本目錄包含智慧道路守護系統背景警示與路線規劃功能的完整 API 規格文件（OpenAPI 3.0 格式）。

### 檔案清單

- **openapi.yaml**: 完整的 OpenAPI 3.0 規格文件（繁體中文）
- **README.md**: 本文件，提供 API 使用指南和開發說明

---

## API 總覽

### API 群組

本系統提供 5 個主要的 API 群組：

#### 1. Settings API（使用者設定）
管理使用者的背景警示偏好設定。

| 方法 | 端點 | 描述 |
|------|------|------|
| GET | `/api/settings` | 取得使用者設定 |
| PUT | `/api/settings` | 更新使用者設定 |

**主要功能**:
- 警示方式設定（震動、音效、兩者、關閉）
- 事故數量篩選閾值（1-10）
- 警示距離設定（50-500 公尺）
- 啟用/停用背景警示

#### 2. Route Planning API（路線規劃）
提供路線規劃和安全性評估功能。

| 方法 | 端點 | 描述 |
|------|------|------|
| POST | `/api/routes/plan` | 規劃路線 |
| GET | `/api/routes/{routeId}` | 取得路線資訊 |
| GET | `/api/routes/{routeId}/safety` | 取得路線安全統計 |

**主要功能**:
- 整合 Mapbox Directions API 規劃路線
- 計算路線經過的事故熱點
- 提供風險評分和安全建議
- 支援多種導航模式（駕駛、步行、自行車）

#### 3. Geocoding API（地址搜尋）
提供地址搜尋和反向地理編碼功能。

| 方法 | 端點 | 描述 |
|------|------|------|
| GET | `/api/geocoding/search` | 地址搜尋 |
| GET | `/api/geocoding/reverse` | 反向地理編碼 |

**主要功能**:
- 地址自動完成建議
- 整合使用者搜尋歷史
- 座標轉地址（反向地理編碼）

#### 4. Monitoring API（背景監控）
提供即時位置監控和熱點接近檢查。

| 方法 | 端點 | 描述 |
|------|------|------|
| POST | `/api/monitoring/check-proximity` | 檢查是否接近熱點 |
| GET | `/api/monitoring/nearby-hotspots` | 取得附近熱點 |

**主要功能**:
- 即時檢查使用者是否接近危險路段
- 查詢附近事故熱點
- 提供警示觸發判斷

#### 5. Search History API（搜尋歷史）
管理使用者的地址搜尋歷史。

| 方法 | 端點 | 描述 |
|------|------|------|
| GET | `/api/search-history` | 取得搜尋歷史 |
| POST | `/api/search-history` | 新增搜尋記錄 |

**主要功能**:
- 儲存和檢索搜尋歷史
- 支援 UPSERT 操作（重複地址更新次數）
- 依搜尋頻率和時間排序

---

## 快速開始

### 1. 檢視 API 規格

使用任何支援 OpenAPI 3.0 的工具檢視 `openapi.yaml`：

#### 線上工具
- **Swagger Editor**: https://editor.swagger.io/
  - 將 `openapi.yaml` 內容貼上即可

#### 本地工具
```bash
# 使用 Swagger UI Docker
docker run -p 8080:8080 -e SWAGGER_JSON=/api/openapi.yaml \
  -v $(pwd):/api swaggerapi/swagger-ui

# 瀏覽器開啟 http://localhost:8080
```

#### VSCode 擴充套件
- **OpenAPI (Swagger) Editor**: 提供語法高亮和即時預覽
- **REST Client**: 可直接測試 API

### 2. 產生程式碼

使用 OpenAPI Generator 自動產生 client 或 server 程式碼：

#### 產生 TypeScript 前端 Client
```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o ../../../frontend/src/api/generated
```

#### 產生 Python FastAPI Server
```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python-fastapi \
  -o ../../../backend/src/api/generated
```

### 3. 執行 API 測試

使用 Postman、Insomnia 或 REST Client 匯入 `openapi.yaml` 進行測試。

---

## API 認證

所有 API 端點皆需要 JWT 認證（除了公開端點）。

### 認證方式

在 HTTP 請求標頭加入 Bearer Token：

```http
Authorization: Bearer <JWT_TOKEN>
```

### 取得 Token

```bash
# 登入取得 JWT token
curl -X POST https://api.roadguard.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 回應
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 123
}
```

---

## 使用範例

### 範例 1: 取得使用者設定

```bash
curl -X GET https://api.roadguard.com/v1/api/settings \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**回應**:
```json
{
  "id": 1,
  "userId": 123,
  "alertMode": "both",
  "accidentThreshold": 1,
  "alertDistanceMeters": 200,
  "isEnabled": true,
  "createdAt": "2025-11-08T10:30:00Z",
  "updatedAt": "2025-11-08T10:30:00Z"
}
```

### 範例 2: 更新警示方式

```bash
curl -X PUT https://api.roadguard.com/v1/api/settings \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "alertMode": "vibration_only",
    "accidentThreshold": 3
  }'
```

### 範例 3: 規劃路線

```bash
curl -X POST https://api.roadguard.com/v1/api/routes/plan \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "originLat": 25.0408,
    "originLng": 121.5678,
    "originAddress": "台北市信義區市府路1號",
    "destinationLat": 25.0448,
    "destinationLng": 121.5154,
    "destinationAddress": "台北市中正區重慶南路一段122號",
    "profile": "driving-traffic"
  }'
```

**回應**:
```json
{
  "route": {
    "id": 1,
    "userId": 123,
    "originAddress": "台北市信義區市府路1號",
    "destinationAddress": "台北市中正區重慶南路一段122號",
    "routeGeom": {
      "type": "LineString",
      "coordinates": [[121.5678, 25.0408], [121.5154, 25.0448]]
    },
    "distanceMeters": 5234.5,
    "durationSeconds": 892.3,
    "profile": "driving-traffic",
    "isActive": true
  },
  "safetySummary": {
    "totalAccidents": 12,
    "a1Count": 2,
    "a2Count": 5,
    "a3Count": 5,
    "riskScore": 21.0,
    "suggestPublicTransport": true
  },
  "hotspots": [
    {
      "id": 42,
      "locationName": "忠孝東路與敦化南路口",
      "severity": "A1",
      "totalCount": 5,
      "distanceToRoute": 85.3
    }
  ]
}
```

### 範例 4: 檢查是否接近熱點

```bash
curl -X POST https://api.roadguard.com/v1/api/monitoring/check-proximity \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 25.0420,
    "lng": 121.5654
  }'
```

**回應**:
```json
{
  "isNearHotspot": true,
  "shouldAlert": true,
  "nearbyHotspots": [
    {
      "id": 42,
      "locationName": "忠孝東路與敦化南路口",
      "severity": "A1",
      "totalCount": 5,
      "distance": 185.3,
      "direction": "東北方"
    }
  ],
  "message": "前方 185 公尺處有高風險路段"
}
```

### 範例 5: 地址搜尋

```bash
curl -X GET "https://api.roadguard.com/v1/api/geocoding/search?q=市府路&limit=5" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**回應**:
```json
{
  "results": [
    {
      "address": "台北市信義區市府路1號",
      "lat": 25.0408,
      "lng": 121.5678,
      "source": "history",
      "relevance": 1.0
    },
    {
      "address": "新北市板橋區府中路29號",
      "lat": 25.0119,
      "lng": 121.4627,
      "source": "mapbox",
      "relevance": 0.85
    }
  ],
  "total": 2
}
```

---

## 錯誤處理

所有 API 錯誤回應遵循統一格式：

### 標準錯誤回應格式

```json
{
  "error": "error_code",
  "message": "錯誤訊息描述",
  "details": {
    // 可選的詳細錯誤資訊
  }
}
```

### HTTP 狀態碼

| 狀態碼 | 說明 | 範例 |
|--------|------|------|
| 200 | 成功 | 取得資源成功 |
| 201 | 已建立 | 路線規劃成功 |
| 400 | 請求錯誤 | 缺少必要參數 |
| 401 | 未授權 | JWT token 無效或過期 |
| 404 | 找不到資源 | 路線 ID 不存在 |
| 422 | 驗證失敗 | 參數超出範圍 |
| 500 | 伺服器錯誤 | 資料庫連線失敗 |
| 503 | 服務不可用 | Mapbox API 無法連線 |

### 驗證錯誤回應範例

```json
{
  "error": "validation_error",
  "message": "請求資料驗證失敗",
  "errors": [
    {
      "field": "accidentThreshold",
      "message": "必須介於 1 和 10 之間"
    },
    {
      "field": "alertMode",
      "message": "必須為 vibration_only、sound_only、both 或 disabled"
    }
  ]
}
```

---

## 資料模型重點

### 1. 警示方式 (AlertMode)

| 值 | 說明 | 平台支援 |
|----|------|---------|
| `vibration_only` | 僅震動 | 僅 Android |
| `sound_only` | 僅音效 | 所有平台 |
| `both` | 震動+音效 | 所有平台（iOS 無震動） |
| `disabled` | 關閉警示 | 所有平台 |

### 2. 導航模式 (Profile)

| 值 | 說明 | 適用場景 |
|----|------|---------|
| `driving-traffic` | 一般駕駛（考慮路況） | 預設選項，即時路況 |
| `driving` | 駕駛（不考慮路況） | 速度優先 |
| `walking` | 步行 | 人行道路線 |
| `cycling` | 自行車 | 自行車道路線 |

### 3. 事故嚴重程度 (Severity)

| 等級 | 說明 | 風險權重 |
|------|------|---------|
| A1 | 死亡事故 | 3 分 |
| A2 | 受傷事故 | 2 分 |
| A3 | 財損事故 | 1 分 |

### 4. 風險評分計算

```
風險評分 = A1 數量 × 3 + A2 數量 × 2 + A3 數量 × 1

建議使用大眾交通工具條件：風險評分 > 15
```

**範例**:
- 路線經過 2 個 A1、5 個 A2、5 個 A3 熱點
- 風險評分 = 2×3 + 5×2 + 5×1 = 6 + 10 + 5 = 21
- suggestPublicTransport = true（21 > 15）

---

## 整合 Mapbox API

### Mapbox Directions API

路線規劃功能整合 Mapbox Directions API：

- **端點**: `https://api.mapbox.com/directions/v5/mapbox/{profile}/{coordinates}`
- **免費額度**: 100,000 次請求/月
- **超額計費**: $2 / 1,000 次
- **文件**: https://docs.mapbox.com/api/navigation/directions/

### Mapbox Geocoding API

地址搜尋功能整合 Mapbox Geocoding API：

- **端點**: `https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json`
- **免費額度**: 100,000 次請求/月
- **超額計費**: $0.50 / 1,000 次
- **文件**: https://docs.mapbox.com/api/search/geocoding/

### 成本控制策略

1. **前端快取**: 使用 IndexedDB 快取路線（1 小時有效期）
2. **用量監控**: 在 Mapbox Dashboard 設定用量警報
3. **限流保護**: 實作 API 請求節流（throttle）
4. **備用方案**: 準備遷移至 OSRM（自架方案）

---

## 效能指標

### API 回應時間目標

| API 群組 | 目標回應時間 (p95) |
|---------|-------------------|
| Settings | < 100ms |
| Routes (查詢) | < 200ms |
| Routes (規劃) | < 2s |
| Geocoding | < 500ms |
| Monitoring | < 100ms |
| SearchHistory | < 100ms |

### 資料庫查詢最佳化

- 使用 PostGIS GIST 空間索引
- ST_DWithin 查詢響應 < 100ms（10 萬筆資料）
- 定期執行 VACUUM ANALYZE 和 CLUSTER

### 快取策略

- 路線快取命中率目標: > 60%
- 地址搜尋快取有效期: 1 小時
- 熱點資料快取有效期: 5 分鐘

---

## 開發工具

### 推薦工具

1. **API 測試**:
   - [Postman](https://www.postman.com/): 功能強大的 API 測試工具
   - [Insomnia](https://insomnia.rest/): 簡潔的 REST client
   - [REST Client (VSCode)](https://marketplace.visualstudio.com/items?itemName=humao.rest-client): VSCode 擴充套件

2. **OpenAPI 編輯器**:
   - [Swagger Editor](https://editor.swagger.io/): 線上編輯器
   - [Stoplight Studio](https://stoplight.io/studio): 視覺化 API 設計工具

3. **程式碼產生器**:
   - [OpenAPI Generator](https://openapi-generator.tech/): 支援多種語言
   - [Swagger Codegen](https://swagger.io/tools/swagger-codegen/): 官方工具

### 驗證 OpenAPI 規格

```bash
# 使用 OpenAPI CLI 驗證
npx @openapitools/openapi-generator-cli validate -i openapi.yaml

# 使用 Spectral 進行 Linting
npx @stoplight/spectral-cli lint openapi.yaml
```

---

## 版本控制

### API 版本策略

- 目前版本: `v1`
- 版本控制方式: URL 路徑（`/v1/api/...`）
- 向後相容性保證: 主版本內不會有破壞性變更

### 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0.0 | 2025-11-08 | 初始版本，包含所有核心 API |

---

## 安全性考量

### 1. 認證與授權
- 所有端點皆需 JWT 認證
- Token 有效期: 24 小時
- 支援 refresh token 機制

### 2. 輸入驗證
- 所有座標參數驗證範圍（緯度 -90~90，經度 -180~180）
- 字串長度限制（地址最長 500 字元）
- 數值範圍檢查（閾值 1-10，距離 50-500）

### 3. 速率限制
- 一般 API: 100 次/分鐘/使用者
- 路線規劃 API: 10 次/分鐘/使用者
- 超過限制回傳 429 Too Many Requests

### 4. HTTPS 強制
- 生產環境強制使用 HTTPS
- 拒絕 HTTP 連線

---

## 常見問題 (FAQ)

### Q1: 為什麼 iOS 裝置的震動警示無法使用？

A: Web Vibration API 在 iOS Safari 上不支援。系統會自動降級為音效警示。建議使用 `alertMode: "both"` 以相容所有平台。

### Q2: 路線規劃失敗回傳 503 錯誤怎麼辦？

A: 這表示 Mapbox Directions API 暫時無法使用。請稍後重試，或檢查網路連線狀態。

### Q3: 如何避免 Mapbox API 超額計費？

A: 系統已實作前端快取（IndexedDB），相同路線 1 小時內不會重複請求。建議在 Mapbox Dashboard 設定用量警報。

### Q4: 地址搜尋為什麼會同時回傳歷史和 Mapbox 結果？

A: 為了提升使用者體驗，系統優先顯示使用者的搜尋歷史（`source: "history"`），並補充 Mapbox Geocoding API 的結果（`source: "mapbox"`）。

### Q5: 風險評分的閾值 15 分是如何決定的？

A: 閾值 15 分是根據 A1×3 + A2×2 + A3×1 的加權公式，經過初步評估設定。未來可能根據實際使用情況調整。

---

## 聯絡資訊

如有任何 API 相關問題，請聯繫：

- **Email**: support@roadguard.com
- **GitHub Issues**: https://github.com/roadguard/smart-road-safety-system/issues
- **文件**: https://docs.roadguard.com

---

**文件版本**: 1.0.0
**最後更新**: 2025-11-08
**維護者**: Development Team
