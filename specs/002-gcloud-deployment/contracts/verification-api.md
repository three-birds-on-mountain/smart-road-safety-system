# 驗證 API 合約

**功能**: Google Cloud Run 部署驗證
**日期**: 2025-11-08
**相關**: [spec.md](../spec.md) | [deployment-api.md](./deployment-api.md)

## 概述

本文件定義部署後驗證的 API 合約，確保服務正確運行並符合預期功能。驗證分為三個層次：服務層、API 層、整合層。

---

## 後端驗證 API

### 1. Health Check Endpoint

**用途**: 驗證後端服務運行狀態和資料庫連線

**端點**: `GET /api/v1/health`

**請求**:
```http
GET /api/v1/health HTTP/1.1
Host: backend-url.run.app
```

**成功回應** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-11-08T12:00:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

**欄位說明**:
- `status`: 服務狀態 ("healthy" | "degraded" | "unhealthy")
- `timestamp`: 檢查時間（ISO 8601 格式）
- `database`: 資料庫連線狀態 ("connected" | "disconnected")
- `version`: 應用程式版本

**降級回應** (200 OK - 但有問題):
```json
{
  "status": "degraded",
  "timestamp": "2025-11-08T12:00:00.000Z",
  "database": "disconnected",
  "version": "1.0.0",
  "issues": [
    "Database connection failed"
  ]
}
```

**錯誤回應** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "timestamp": "2025-11-08T12:00:00.000Z",
  "error": "Service initialization failed"
}
```

**驗證標準**:
- ✓ HTTP 狀態碼為 200
- ✓ `status` 為 "healthy"
- ✓ `database` 為 "connected"
- ✓ 回應時間 < 2 秒

---

### 2. API Endpoint 測試

#### 2.1 查詢附近熱點

**端點**: `GET /api/v1/hotspots/nearby`

**用途**: 驗證核心 API 功能（資料庫查詢、地理運算）

**請求**:
```http
GET /api/v1/hotspots/nearby?lat=25.033&lng=121.5654&radius=1000 HTTP/1.1
Host: backend-url.run.app
```

**成功回應** (200 OK):
```json
{
  "hotspots": [
    {
      "id": "hotspot-001",
      "lat": 25.034,
      "lng": 121.566,
      "radius": 500,
      "accident_count": 15,
      "severity_distribution": {
        "A1": 1,
        "A2": 8,
        "A3": 6
      },
      "distance": 150.5
    }
  ],
  "user_location": {
    "lat": 25.033,
    "lng": 121.5654
  },
  "search_radius": 1000,
  "total_count": 1
}
```

**空結果回應** (200 OK):
```json
{
  "hotspots": [],
  "user_location": {
    "lat": 25.033,
    "lng": 121.5654
  },
  "search_radius": 1000,
  "total_count": 0
}
```

**參數驗證錯誤** (422 Unprocessable Entity):
```json
{
  "detail": [
    {
      "loc": ["query", "lat"],
      "msg": "Latitude must be between -90 and 90",
      "type": "value_error"
    }
  ]
}
```

**驗證標準**:
- ✓ HTTP 狀態碼為 200 或 422（參數錯誤時）
- ✓ 成功時回傳 hotspots 陣列（可為空）
- ✓ 回應包含必要欄位（user_location, search_radius, total_count）
- ✓ 回應時間 < 500ms（p95）

---

#### 2.2 查詢熱點詳細資訊

**端點**: `GET /api/v1/hotspots/{hotspot_id}`

**用途**: 驗證詳細查詢功能

**請求**:
```http
GET /api/v1/hotspots/hotspot-001 HTTP/1.1
Host: backend-url.run.app
```

**成功回應** (200 OK):
```json
{
  "id": "hotspot-001",
  "lat": 25.034,
  "lng": 121.566,
  "radius": 500,
  "accident_count": 15,
  "severity_distribution": {
    "A1": 1,
    "A2": 8,
    "A3": 6
  },
  "time_distribution": {
    "morning": 3,
    "afternoon": 5,
    "evening": 4,
    "night": 3
  },
  "recent_accidents": [
    {
      "id": "accident-001",
      "date": "2025-10-15",
      "severity": "A2",
      "lat": 25.034,
      "lng": 121.566
    }
  ]
}
```

**未找到回應** (404 Not Found):
```json
{
  "detail": "Hotspot not found"
}
```

**驗證標準**:
- ✓ HTTP 狀態碼為 200 或 404
- ✓ 成功時回傳完整熱點資訊
- ✓ 包含事故統計和最近事故列表

---

### 3. CORS 標頭驗證

**端點**: `OPTIONS /api/v1/health`

**用途**: 驗證 CORS 設定正確

**請求**:
```http
OPTIONS /api/v1/health HTTP/1.1
Host: backend-url.run.app
Origin: https://frontend-url.run.app
Access-Control-Request-Method: GET
```

**成功回應** (200 OK):
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://frontend-url.run.app
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Max-Age: 3600
```

**驗證標準**:
- ✓ HTTP 狀態碼為 200
- ✓ `Access-Control-Allow-Origin` 包含前端 URL
- ✓ `Access-Control-Allow-Methods` 包含必要的 HTTP 方法

---

## 前端驗證 API

### 1. 首頁載入

**端點**: `GET /`

**用途**: 驗證前端服務運行和靜態檔案正確

**請求**:
```http
GET / HTTP/1.1
Host: frontend-url.run.app
```

**成功回應** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: XXXX

<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8">
    <title>智慧道路守護系統</title>
    ...
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-xxx.js"></script>
  </body>
</html>
```

**驗證標準**:
- ✓ HTTP 狀態碼為 200
- ✓ Content-Type 為 text/html
- ✓ HTML 包含 `<div id="root">`
- ✓ 包含 Vite 建置的 JS bundle 參照
- ✓ 回應時間 < 1 秒

---

### 2. 靜態資源載入

**端點**: `GET /assets/{filename}`

**用途**: 驗證靜態資源正確服務且有快取標頭

**請求**:
```http
GET /assets/index-abc123.js HTTP/1.1
Host: frontend-url.run.app
```

**成功回應** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: public, max-age=31536000, immutable
Content-Length: XXXX

[JavaScript content]
```

**驗證標準**:
- ✓ HTTP 狀態碼為 200
- ✓ 正確的 Content-Type
- ✓ Cache-Control 設定為長期快取（1 年）
- ✓ 包含 `immutable` 指令

---

### 3. SPA 路由測試

**端點**: `GET /settings`

**用途**: 驗證 SPA 路由正確（所有路徑都回傳 index.html）

**請求**:
```http
GET /settings HTTP/1.1
Host: frontend-url.run.app
```

**成功回應** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html lang="zh-TW">
  ...
</html>
```

**驗證標準**:
- ✓ HTTP 狀態碼為 200（不是 404）
- ✓ 回傳 index.html（與 GET / 相同）
- ✓ React Router 會處理客戶端路由

---

### 4. 安全標頭驗證

**端點**: `GET /`

**用途**: 驗證安全標頭正確設定

**請求**:
```http
GET / HTTP/1.1
Host: frontend-url.run.app
```

**成功回應** (200 OK):
```http
HTTP/1.1 200 OK
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self' ...
```

**驗證標準**:
- ✓ `X-Frame-Options` 設定為 SAMEORIGIN 或 DENY
- ✓ `X-Content-Type-Options` 設定為 nosniff
- ✓ `X-XSS-Protection` 設定為 1; mode=block
- ✓ （可選）Content-Security-Policy 設定

---

## 整合驗證

### 1. 前端呼叫後端 API

**用途**: 驗證前端可正確呼叫後端且無 CORS 錯誤

**測試步驟**:
1. 開啟前端 URL
2. 打開瀏覽器開發者工具（Network）
3. 觀察 API 請求

**預期結果**:
- ✓ 前端成功發送請求到後端
- ✓ 後端回應成功（200 OK）
- ✓ 無 CORS 錯誤訊息

**CORS 錯誤範例**（不應該出現）:
```
Access to fetch at 'https://backend-url/api/v1/hotspots/nearby'
from origin 'https://frontend-url' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**自動化測試**:
```bash
# 從前端 URL 發送請求到後端
curl -H "Origin: https://frontend-url" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://backend-url/api/v1/health \
     -i

# 檢查回應包含正確的 CORS 標頭
```

---

### 2. 端到端功能測試

**用途**: 驗證完整使用者流程

**測試場景**:

#### 場景 1: 地圖顯示熱點
1. 開啟前端首頁
2. 地圖載入完成
3. 自動查詢附近熱點
4. 熱點標記顯示在地圖上

**驗證點**:
- ✓ 地圖正確載入（Mapbox）
- ✓ 前端成功呼叫 `/api/v1/hotspots/nearby`
- ✓ 熱點資料正確顯示

#### 場景 2: 點擊熱點查看詳情
1. 點擊地圖上的熱點標記
2. 彈出詳細資訊面板
3. 顯示事故統計和時間分布

**驗證點**:
- ✓ 前端成功呼叫 `/api/v1/hotspots/{id}`
- ✓ 詳細資訊正確顯示

#### 場景 3: 調整設定
1. 開啟設定頁面
2. 調整警示距離
3. 設定儲存成功

**驗證點**:
- ✓ 設定頁面載入
- ✓ 設定保存到 localStorage
- ✓ 回到地圖頁面設定生效

---

## 驗證腳本輸出格式

### 標準輸出格式

```
正在驗證 [服務名稱]...

1. Health Check
   ✓ 服務回應正常 (200 OK)
   ✓ 資料庫連線正常
   ✓ 回應時間: 125ms

2. API Endpoints
   ✓ /api/v1/hotspots/nearby 回應正常
   ✓ /api/v1/hotspots/{id} 回應正常
   ✓ 平均回應時間: 340ms

3. CORS Configuration
   ✓ CORS 標頭正確
   ✓ 允許的 origins: https://frontend-url

驗證結果: 通過 (3/3 項目)
```

### 失敗輸出格式

```
正在驗證 [服務名稱]...

1. Health Check
   ✗ 服務回應異常 (503 Service Unavailable)
   ✗ 資料庫連線失敗
   錯誤: connection refused

驗證結果: 失敗 (0/1 項目)

建議:
- 檢查 Cloud Run 服務日誌
- 驗證 DATABASE_URL 環境變數
- 確認 Cloud SQL 實例運行中
```

---

## 效能指標

### 回應時間標準

| Endpoint | p50 | p95 | p99 | 最大值 |
|----------|-----|-----|-----|--------|
| Health Check | < 100ms | < 200ms | < 500ms | 2s |
| Hotspots Nearby | < 200ms | < 500ms | < 1s | 3s |
| Hotspot Detail | < 150ms | < 300ms | < 800ms | 2s |
| Frontend Page | < 500ms | < 1s | < 2s | 5s |
| Static Assets | < 100ms | < 200ms | < 500ms | 1s |

### 可用性標準

- **目標 SLA**: 99.5% uptime
- **Health Check 成功率**: > 99%
- **API 錯誤率**: < 1%

---

## 監控查詢

### Cloud Logging 查詢範例

**查看所有錯誤**:
```
resource.type="cloud_run_revision"
AND resource.labels.service_name="road-safety-backend"
AND severity>=ERROR
```

**查看慢請求**:
```
resource.type="cloud_run_revision"
AND resource.labels.service_name="road-safety-backend"
AND httpRequest.latency>"0.5s"
```

**查看特定端點**:
```
resource.type="cloud_run_revision"
AND httpRequest.requestUrl=~"/api/v1/hotspots/nearby"
```

---

## 總結

本驗證 API 合約定義了：

1. **後端驗證**: Health check, API endpoints, CORS
2. **前端驗證**: 頁面載入, 靜態資源, SPA 路由, 安全標頭
3. **整合驗證**: 前後端通訊, 端到端功能流程
4. **效能標準**: 回應時間和可用性目標
5. **監控方式**: Cloud Logging 查詢範例

所有驗證標準都是可測試和可量化的，確保部署品質。

---

**文件版本**: 1.0
**建立日期**: 2025-11-08
