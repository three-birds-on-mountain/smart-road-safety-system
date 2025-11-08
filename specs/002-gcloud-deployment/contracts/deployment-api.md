# 部署操作 API 合約

**功能**: Google Cloud Run 部署
**日期**: 2025-11-08
**相關**: [spec.md](../spec.md) | [data-model.md](../data-model.md)

## 概述

本文件定義部署操作的 API 合約。雖然部署主要透過 gcloud CLI 執行，但我們定義標準化的腳本介面，確保部署操作的一致性和可重複性。

---

## 部署腳本 API

### 1. 部署後端服務

**腳本**: `scripts/deploy/deploy-backend.sh`

**用途**: 建置並部署後端服務到 Cloud Run

**輸入參數** (環境變數):

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| PROJECT_ID | string | ✓ | - | GCP 專案 ID |
| REGION | string | ○ | asia-east1 | 部署區域 |
| SERVICE_NAME | string | ○ | road-safety-backend | 服務名稱 |
| DB_PASSWORD | string | ✓ | - | 資料庫密碼 |
| CORS_ORIGINS | string | ○ | * | CORS 允許的 origins |

**執行範例**:
```bash
export PROJECT_ID="three-birds-on-mountain"
export DB_PASSWORD="secret-password"
export CORS_ORIGINS="https://frontend-url"

./scripts/deploy/deploy-backend.sh
```

**執行流程**:
1. 驗證必要環境變數已設定
2. 建置 Docker 映像（Cloud Build）
3. 部署到 Cloud Run
4. 輸出部署結果（服務 URL）

**輸出** (stdout):
```
正在建置 Docker 映像...
✓ 映像建置完成: asia-east1-docker.pkg.dev/...

正在部署到 Cloud Run...
✓ 部署完成

服務 URL: https://road-safety-backend-xxx.asia-east1.run.app
```

**錯誤處理**:
- 環境變數缺失 → 錯誤訊息並退出 (exit code 1)
- 建置失敗 → 顯示 Cloud Build 錯誤並退出 (exit code 1)
- 部署失敗 → 顯示 gcloud 錯誤並退出 (exit code 1)

**退出碼**:
- `0`: 部署成功
- `1`: 部署失敗

**前置條件**:
- gcloud CLI 已安裝並認證
- Docker 已安裝（本地測試用）
- Artifact Registry 已建立
- Cloud SQL 實例已存在

**後置條件**:
- 後端服務已部署並運行
- 服務可透過 URL 存取
- 資料庫連線正常

---

### 2. 部署前端服務

**腳本**: `scripts/deploy/deploy-frontend.sh`

**用途**: 建置並部署前端服務到 Cloud Run

**輸入參數** (環境變數):

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| PROJECT_ID | string | ✓ | - | GCP 專案 ID |
| REGION | string | ○ | asia-east1 | 部署區域 |
| SERVICE_NAME | string | ○ | road-safety-frontend | 服務名稱 |
| BACKEND_URL | string | ✓ | - | 後端 API URL |
| MAPBOX_TOKEN | string | ✓ | - | Mapbox Token |

**執行範例**:
```bash
export PROJECT_ID="three-birds-on-mountain"
export BACKEND_URL="https://backend-url.run.app"
export MAPBOX_TOKEN="pk.xxx"

./scripts/deploy/deploy-frontend.sh
```

**執行流程**:
1. 驗證必要環境變數已設定
2. 建置 Docker 映像（Cloud Build + 注入環境變數）
3. 部署到 Cloud Run
4. 更新後端 CORS 設定（使用前端 URL）
5. 輸出部署結果（服務 URL）

**輸出** (stdout):
```
正在建置前端映像（注入 API_URL 和 MAPBOX_TOKEN）...
✓ 映像建置完成

正在部署到 Cloud Run...
✓ 部署完成

正在更新後端 CORS 設定...
✓ CORS 設定已更新

服務 URL: https://road-safety-frontend-xxx.asia-east1.run.app
```

**退出碼**:
- `0`: 部署成功
- `1`: 部署失敗

**前置條件**:
- 後端服務已部署
- cloudbuild.yaml 和 Dockerfile 已建立
- nginx.conf 已設定

**後置條件**:
- 前端服務已部署並運行
- 前端可正確呼叫後端 API（無 CORS 錯誤）

---

### 3. 執行資料庫 Migration

**腳本**: `scripts/deploy/run-migration.sh`

**用途**: 透過 Cloud SQL Proxy 執行 Alembic migration

**輸入參數** (環境變數):

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| PROJECT_ID | string | ✓ | - | GCP 專案 ID |
| REGION | string | ○ | asia-east1 | 部署區域 |
| CLOUD_SQL_INSTANCE | string | ✓ | - | Cloud SQL 實例名稱 |
| DB_USER | string | ✓ | - | 資料庫使用者名稱 |
| DB_PASSWORD | string | ✓ | - | 資料庫密碼 |
| DB_NAME | string | ✓ | - | 資料庫名稱 |

**執行範例**:
```bash
export PROJECT_ID="three-birds-on-mountain"
export CLOUD_SQL_INSTANCE="tpml-seat-tracker-db"
export DB_USER="road_safety_user"
export DB_PASSWORD="secret-password"
export DB_NAME="road_safety_db"

./scripts/deploy/run-migration.sh
```

**執行流程**:
1. 檢查 Cloud SQL Proxy 是否已安裝
2. 啟動 Cloud SQL Proxy (背景執行)
3. 等待 Proxy 就緒
4. 執行 `alembic upgrade head`
5. 驗證 migration 成功（查詢 alembic_version）
6. 關閉 Cloud SQL Proxy

**輸出** (stdout):
```
正在啟動 Cloud SQL Proxy...
✓ Proxy 已啟動

正在執行 database migration...
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> abc123, initial schema
✓ Migration 完成

目前版本: abc123

正在關閉 Cloud SQL Proxy...
✓ Proxy 已關閉
```

**退出碼**:
- `0`: Migration 成功
- `1`: Migration 失敗

**前置條件**:
- Cloud SQL Proxy 已安裝
- Cloud SQL 實例已存在且運行
- 資料庫和使用者已建立
- Alembic migration 檔案已準備

**後置條件**:
- 資料庫 schema 已更新到最新版本
- alembic_version 表已更新

---

### 4. 驗證部署

**腳本**: `scripts/deploy/verify-deployment.sh`

**用途**: 驗證部署是否成功

**輸入參數** (環境變數):

| 參數 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| PROJECT_ID | string | ✓ | - | GCP 專案 ID |
| REGION | string | ○ | asia-east1 | 部署區域 |
| BACKEND_SERVICE | string | ○ | road-safety-backend | 後端服務名稱 |
| FRONTEND_SERVICE | string | ○ | road-safety-frontend | 前端服務名稱 |

**執行範例**:
```bash
export PROJECT_ID="three-birds-on-mountain"

./scripts/deploy/verify-deployment.sh
```

**執行流程**:
1. 取得後端和前端服務 URL
2. 驗證後端 health endpoint
3. 驗證後端 API endpoints
4. 驗證前端頁面載入
5. 驗證前端可呼叫後端（CORS）
6. 輸出驗證結果

**輸出** (stdout):
```
正在驗證後端部署...
  ✓ Health endpoint 回應正常
  ✓ 資料庫連線正常
  ✓ API endpoints 運作正常

正在驗證前端部署...
  ✓ 前端頁面載入成功
  ✓ 靜態資源載入正常

正在驗證整合...
  ✓ 前端可呼叫後端 API (無 CORS 錯誤)

✓ 所有驗證通過
```

**退出碼**:
- `0`: 所有驗證通過
- `1`: 至少一項驗證失敗

**驗證項目**:

1. **後端 Health Check**
   - Endpoint: `GET /api/v1/health`
   - 預期狀態碼: 200
   - 預期回應: `{"status": "healthy", "database": "connected"}`

2. **後端 API Endpoints**
   - Endpoint: `GET /api/v1/hotspots/nearby?lat=25.033&lng=121.5654&radius=1000`
   - 預期狀態碼: 200
   - 預期回應: JSON 陣列（可能為空）

3. **前端頁面**
   - Endpoint: `GET /`
   - 預期狀態碼: 200
   - 預期 Content-Type: text/html

4. **CORS 整合**
   - 從前端 URL 發送 OPTIONS 請求到後端
   - 檢查 `Access-Control-Allow-Origin` 標頭

---

### 5. 完整部署流程

**腳本**: `scripts/deploy/deploy-all.sh`

**用途**: 執行完整的部署流程（migration + backend + frontend + verification）

**輸入參數**: 結合上述所有腳本的參數

**執行範例**:
```bash
# 設定所有必要環境變數
export PROJECT_ID="three-birds-on-mountain"
export DB_PASSWORD="secret"
export MAPBOX_TOKEN="pk.xxx"
# ... 其他環境變數

./scripts/deploy/deploy-all.sh
```

**執行流程**:
```
1. run-migration.sh       → 執行 database migration
2. deploy-backend.sh      → 部署後端
3. verify-backend         → 驗證後端
4. deploy-frontend.sh     → 部署前端（使用後端 URL）
5. verify-frontend        → 驗證前端
6. verify-integration     → 驗證整合
```

**輸出**:
```
[1/6] 執行 database migration...
✓ Migration 完成

[2/6] 部署後端服務...
✓ 後端部署完成
後端 URL: https://backend-url

[3/6] 驗證後端...
✓ 後端驗證通過

[4/6] 部署前端服務...
✓ 前端部署完成
前端 URL: https://frontend-url

[5/6] 驗證前端...
✓ 前端驗證通過

[6/6] 驗證整合...
✓ 整合驗證通過

==========================================
✓ 部署流程全部完成！

後端 URL: https://backend-url
前端 URL: https://frontend-url

API 文件: https://backend-url/docs
==========================================
```

**錯誤處理**:
- 任何步驟失敗 → 停止後續步驟並報錯
- 可選: `--continue-on-error` 參數繼續執行

---

## 腳本介面規範

所有部署腳本必須遵循以下規範：

### 退出碼

- `0`: 成功
- `1`: 一般錯誤
- `2`: 參數錯誤
- `3`: 前置條件未滿足

### 輸出格式

**成功訊息**:
```
✓ [操作] 完成
```

**進行中訊息**:
```
正在 [操作]...
```

**錯誤訊息**:
```
✗ 錯誤: [錯誤描述]
```

### 環境變數讀取

腳本應支援：
1. 命令列參數（優先）
2. 環境變數
3. 預設值

### 日誌輸出

- `stdout`: 正常訊息和進度
- `stderr`: 錯誤訊息
- 可選: `--verbose` 參數顯示詳細輸出

---

## 錯誤碼定義

| 錯誤碼 | 說明 | 處理方式 |
|--------|------|---------|
| E001 | 環境變數缺失 | 檢查並設定必要的環境變數 |
| E002 | gcloud 認證失敗 | 執行 `gcloud auth login` |
| E003 | Docker 建置失敗 | 檢查 Dockerfile 和建置日誌 |
| E004 | Cloud Run 部署失敗 | 檢查 Cloud Run 配置和權限 |
| E005 | 資料庫連線失敗 | 檢查 DATABASE_URL 和 Cloud SQL 狀態 |
| E006 | Migration 失敗 | 檢查 Alembic 日誌和資料庫權限 |
| E007 | 驗證失敗 | 檢查服務日誌和 health endpoint |
| E008 | CORS 設定失敗 | 檢查後端 CORS_ORIGINS 環境變數 |

---

## 總結

本合約定義了標準化的部署操作介面，確保：

1. **一致性**: 所有部署腳本使用統一的介面和輸出格式
2. **可重複性**: 相同的輸入產生相同的結果
3. **可維護性**: 清楚的錯誤處理和日誌輸出
4. **可組合性**: 各腳本可獨立執行或組合使用

所有腳本皆為 Shell scripts，使用標準的 Unix 工具，易於理解和除錯。

---

**文件版本**: 1.0
**建立日期**: 2025-11-08
