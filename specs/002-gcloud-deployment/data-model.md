# 資料模型：Google Cloud Run 部署

**功能**: Google Cloud Run 部署
**日期**: 2025-11-08
**相關**: [spec.md](./spec.md) | [plan.md](./plan.md) | [research.md](./research.md)

## 概述

本文件定義部署配置和服務管理的資料結構。雖然部署本身不涉及業務資料模型，但需要明確定義部署配置、環境變數、服務設定等結構，以確保部署流程的一致性和可重複性。

---

## 實體定義

### 1. DeploymentConfig（部署配置）

**用途**: 定義單一服務的部署設定

**屬性**:

| 欄位 | 類型 | 必填 | 說明 | 範例值 |
|------|------|------|------|--------|
| projectId | string | ✓ | GCP 專案 ID | "three-birds-on-mountain" |
| region | string | ✓ | 部署區域 | "asia-east1" |
| serviceName | string | ✓ | Cloud Run 服務名稱 | "road-safety-backend" |
| imageTag | string | ✓ | Docker 映像標籤 | "asia-east1-docker.pkg.dev/..." |
| resourceLimits | ResourceConfig | ✓ | 資源限制設定 | (見下方) |
| environmentVars | Map<string, string> | ✓ | 環境變數 | (見下方) |
| secrets | Map<string, SecretRef> | ○ | Secret Manager 參照 | (見下方) |
| cloudSqlInstances | string[] | ○ | Cloud SQL 實例連線名稱 | ["project:region:instance"] |
| allowUnauthenticated | boolean | ✓ | 是否允許未經驗證的請求 | true / false |

**驗證規則**:
- `serviceName` 必須符合 Cloud Run 命名規範（小寫英數字和連字號）
- `region` 必須是有效的 GCP 區域
- `imageTag` 必須是完整的 Artifact Registry URL

**狀態轉換**:
```
待部署 (Pending) → 建置中 (Building) → 部署中 (Deploying) → 已部署 (Deployed) → 運行中 (Running)
                                                            ↓
                                                         失敗 (Failed)
```

**範例**:
```json
{
  "projectId": "three-birds-on-mountain",
  "region": "asia-east1",
  "serviceName": "road-safety-backend",
  "imageTag": "asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest",
  "resourceLimits": {
    "memory": "512Mi",
    "cpu": "1",
    "minInstances": 0,
    "maxInstances": 10,
    "timeout": 300,
    "concurrency": 80
  },
  "environmentVars": {
    "DATABASE_URL": "postgresql://user:password@/db?host=/cloudsql/...",
    "CORS_ORIGINS": "https://frontend-url",
    "LOG_LEVEL": "INFO",
    "ENVIRONMENT": "production"
  },
  "secrets": {
    "GOOGLE_MAPS_API_KEY": {
      "secretName": "maps-api-key",
      "version": "latest"
    }
  },
  "cloudSqlInstances": [
    "three-birds-on-mountain:asia-east1:tpml-seat-tracker-db"
  ],
  "allowUnauthenticated": true
}
```

---

### 2. ResourceConfig（資源配置）

**用途**: 定義 Cloud Run 服務的資源限制和擴展設定

**屬性**:

| 欄位 | 類型 | 必填 | 說明 | 範例值 | 限制 |
|------|------|------|------|--------|------|
| memory | string | ✓ | 記憶體限制 | "512Mi" | 128Mi - 32Gi |
| cpu | string | ✓ | CPU 核心數 | "1" | 1, 2, 4, 8 |
| minInstances | number | ✓ | 最小實例數 | 0 | 0 - 1000 |
| maxInstances | number | ✓ | 最大實例數 | 10 | 1 - 1000 |
| timeout | number | ○ | 請求超時時間（秒） | 300 | 1 - 3600 |
| concurrency | number | ○ | 每個實例的並發請求數 | 80 | 1 - 1000 |

**驗證規則**:
- `minInstances` ≤ `maxInstances`
- `memory` 和 `cpu` 必須符合 Cloud Run 的有效組合
- 記憶體格式: 數字 + "Mi" 或 "Gi"

**範例**:
```json
{
  "memory": "512Mi",
  "cpu": "1",
  "minInstances": 0,
  "maxInstances": 10,
  "timeout": 300,
  "concurrency": 80
}
```

---

### 3. SecretRef（密碼參照）

**用途**: 參照 Secret Manager 中的密碼

**屬性**:

| 欄位 | 類型 | 必填 | 說明 | 範例值 |
|------|------|------|------|--------|
| secretName | string | ✓ | Secret Manager 中的密碼名稱 | "database-password" |
| version | string | ✓ | 密碼版本 | "latest" 或 "1" |

**範例**:
```json
{
  "secretName": "database-password",
  "version": "latest"
}
```

---

### 4. BuildConfig（建置配置）

**用途**: 定義 Docker 映像建置設定

**屬性**:

| 欄位 | 類型 | 必填 | 說明 | 範例值 |
|------|------|------|------|--------|
| sourceDir | string | ✓ | 原始碼目錄 | "backend/" |
| dockerfilePath | string | ○ | Dockerfile 路徑 | "Dockerfile" |
| buildArgs | Map<string, string> | ○ | Docker build arguments | {"API_URL": "..."} |
| substitutions | Map<string, string> | ○ | Cloud Build 替換變數 | (見下方) |
| imageTag | string | ✓ | 目標映像標籤 | "...backend:latest" |

**範例（後端）**:
```json
{
  "sourceDir": "backend/",
  "dockerfilePath": "Dockerfile",
  "buildArgs": {},
  "substitutions": {},
  "imageTag": "asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest"
}
```

**範例（前端）**:
```json
{
  "sourceDir": "frontend/",
  "dockerfilePath": "Dockerfile",
  "buildArgs": {
    "API_URL": "https://backend-url",
    "MAPBOX_TOKEN": "pk.xxx"
  },
  "substitutions": {
    "_API_URL": "https://backend-url",
    "_MAPBOX_TOKEN": "pk.xxx"
  },
  "imageTag": "asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest"
}
```

---

### 5. MigrationConfig（Migration 配置）

**用途**: 定義資料庫 migration 設定

**屬性**:

| 欄位 | 類型 | 必填 | 說明 | 範例值 |
|------|------|------|------|--------|
| proxyConnectionString | string | ✓ | Cloud SQL Proxy 連線字串 | "project:region:instance" |
| databaseUrl | string | ✓ | 資料庫連線 URL | "postgresql+psycopg2://..." |
| migrationDir | string | ✓ | Migration 檔案目錄 | "backend/alembic/" |
| targetRevision | string | ○ | 目標 revision | "head" |

**範例**:
```json
{
  "proxyConnectionString": "three-birds-on-mountain:asia-east1:tpml-seat-tracker-db",
  "databaseUrl": "postgresql+psycopg2://user:password@127.0.0.1:5432/database",
  "migrationDir": "backend/alembic/",
  "targetRevision": "head"
}
```

---

### 6. VerificationCheck（驗證檢查）

**用途**: 定義部署後的驗證項目

**屬性**:

| 欄位 | 類型 | 必填 | 說明 | 範例值 |
|------|------|------|------|--------|
| checkType | enum | ✓ | 檢查類型 | "health" / "api" / "integration" |
| endpoint | string | ✓ | 檢查端點 URL | "https://.../health" |
| expectedStatus | number | ✓ | 預期 HTTP 狀態碼 | 200 |
| expectedBody | object | ○ | 預期回應內容（部分比對） | {"status": "healthy"} |
| timeout | number | ○ | 超時時間（秒） | 10 |

**檢查類型**:
- `health`: 健康檢查（檢查服務是否運行）
- `api`: API 端點測試（檢查特定 API 功能）
- `integration`: 整合測試（檢查服務間整合）

**範例**:
```json
{
  "checkType": "health",
  "endpoint": "https://backend-url/api/v1/health",
  "expectedStatus": 200,
  "expectedBody": {
    "status": "healthy",
    "database": "connected"
  },
  "timeout": 10
}
```

---

### 7. DeploymentPipeline（部署流程）

**用途**: 定義完整的部署流程

**屬性**:

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| migrationConfig | MigrationConfig | ○ | Migration 配置 |
| backendConfig | DeploymentConfig | ✓ | 後端部署配置 |
| frontendConfig | DeploymentConfig | ✓ | 前端部署配置 |
| verificationChecks | VerificationCheck[] | ✓ | 驗證檢查列表 |

**執行順序**:
1. Migration (如有設定)
2. Backend deployment
3. Backend verification
4. Frontend deployment (使用 backend URL)
5. Frontend verification
6. Integration verification

**範例**:
```json
{
  "migrationConfig": { /* 見上方 */ },
  "backendConfig": { /* 見上方 */ },
  "frontendConfig": { /* 見上方 */ },
  "verificationChecks": [
    {
      "checkType": "health",
      "endpoint": "https://backend-url/api/v1/health",
      "expectedStatus": 200
    },
    {
      "checkType": "api",
      "endpoint": "https://backend-url/api/v1/hotspots/nearby?lat=25&lng=121&radius=1000",
      "expectedStatus": 200
    },
    {
      "checkType": "integration",
      "endpoint": "https://frontend-url",
      "expectedStatus": 200
    }
  ]
}
```

---

## 環境變數結構

### 後端必要環境變數

| 變數名稱 | 類型 | 說明 | 範例值 | 來源 |
|---------|------|------|--------|------|
| DATABASE_URL | string | 資料庫連線 URL | postgresql://user:pass@/db?host=/cloudsql/... | Config |
| CORS_ORIGINS | string | 允許的 CORS origins（逗號分隔） | https://frontend-url | Config |
| LOG_LEVEL | string | 日誌等級 | INFO / DEBUG / ERROR | Config |
| ENVIRONMENT | string | 環境名稱 | production / development | Config |
| GOOGLE_MAPS_API_KEY | string | Google Maps API Key | AIza... | Secret Manager |
| ADMIN_JWT_SECRET | string | JWT 簽名密鑰 | random-secret | Secret Manager |

### 前端建置參數

| 變數名稱 | 類型 | 說明 | 範例值 | 注入方式 |
|---------|------|------|--------|---------|
| VITE_API_URL | string | 後端 API URL | https://backend-url | Build Arg |
| VITE_MAPBOX_TOKEN | string | Mapbox Token | pk.xxx | Build Arg |

---

## 關聯關係

```
DeploymentPipeline
├── 1 MigrationConfig (optional)
├── 1 BackendConfig (DeploymentConfig)
│   ├── 1 ResourceConfig
│   ├── N EnvironmentVars (key-value pairs)
│   └── N Secrets (SecretRef)
└── 1 FrontendConfig (DeploymentConfig)
    ├── 1 ResourceConfig
    └── N EnvironmentVars (key-value pairs)

BuildConfig
└── N BuildArgs / Substitutions (key-value pairs)

VerificationCheck
└── belongs to DeploymentPipeline
```

---

## 資料來源

### 1. 設定檔（可版本控制）
- `scripts/deploy/config.json`: 預設部署配置
- `backend/.env.template`: 後端環境變數範本
- `frontend/.env.template`: 前端環境變數範本

### 2. Secret Manager（敏感資料）
- `database-password`: 資料庫密碼
- `maps-api-key`: Google Maps API Key
- `jwt-secret`: JWT 簽名密鑰
- `mapbox-token`: Mapbox Token

### 3. Cloud Run（運行時狀態）
- Service metadata (URL, status, etc.)
- Resource metrics (CPU, memory usage)
- Logs and traces

### 4. Artifact Registry（映像版本）
- Docker image tags
- Build metadata

---

## 資料持久化

### 配置檔案位置

```
scripts/deploy/
├── config/
│   ├── backend.json          # 後端部署配置
│   ├── frontend.json         # 前端部署配置
│   ├── migration.json        # Migration 配置
│   └── verification.json     # 驗證檢查配置
└── .env.deploy               # 部署用環境變數（不提交 git）
```

### Secret Manager

```bash
# 建立密碼
gcloud secrets create SECRET_NAME --data-file=-

# 授權存取
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:..." \
  --role="roles/secretmanager.secretAccessor"
```

### 部署狀態

Cloud Run 服務狀態儲存在 GCP，可透過 gcloud 指令查詢：

```bash
# 查詢服務狀態
gcloud run services describe SERVICE_NAME --format=json

# 查詢服務 URL
gcloud run services describe SERVICE_NAME --format="value(status.url)"

# 查詢資源使用
gcloud run services describe SERVICE_NAME --format="value(spec.template.spec.containers[0].resources)"
```

---

## 範例：完整部署配置

### backend.json
```json
{
  "projectId": "three-birds-on-mountain",
  "region": "asia-east1",
  "serviceName": "road-safety-backend",
  "imageTag": "asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest",
  "resourceLimits": {
    "memory": "512Mi",
    "cpu": "1",
    "minInstances": 0,
    "maxInstances": 10,
    "timeout": 300,
    "concurrency": 80
  },
  "environmentVars": {
    "DATABASE_URL": "postgresql://road_safety_user:${DB_PASSWORD}@/road_safety_db?host=/cloudsql/three-birds-on-mountain:asia-east1:tpml-seat-tracker-db",
    "CORS_ORIGINS": "https://road-safety-frontend-xxx.asia-east1.run.app",
    "LOG_LEVEL": "INFO",
    "ENVIRONMENT": "production",
    "API_V1_PREFIX": "/api/v1"
  },
  "secrets": {
    "GOOGLE_MAPS_API_KEY": {
      "secretName": "road-safety-maps-api-key",
      "version": "latest"
    },
    "ADMIN_JWT_SECRET": {
      "secretName": "road-safety-jwt-secret",
      "version": "latest"
    }
  },
  "cloudSqlInstances": [
    "three-birds-on-mountain:asia-east1:tpml-seat-tracker-db"
  ],
  "allowUnauthenticated": true
}
```

### frontend.json
```json
{
  "projectId": "three-birds-on-mountain",
  "region": "asia-east1",
  "serviceName": "road-safety-frontend",
  "imageTag": "asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest",
  "resourceLimits": {
    "memory": "256Mi",
    "cpu": "1",
    "minInstances": 0,
    "maxInstances": 5,
    "timeout": 60,
    "concurrency": 80
  },
  "environmentVars": {},
  "secrets": {},
  "cloudSqlInstances": [],
  "allowUnauthenticated": true,
  "buildConfig": {
    "sourceDir": "frontend/",
    "buildArgs": {
      "API_URL": "https://road-safety-backend-xxx.asia-east1.run.app",
      "MAPBOX_TOKEN": "${MAPBOX_TOKEN}"
    }
  }
}
```

---

## 總結

本資料模型定義了 Google Cloud Run 部署所需的所有配置結構。關鍵要點：

1. **DeploymentConfig**: 核心部署配置，定義服務、資源和環境
2. **ResourceConfig**: 資源限制和擴展設定
3. **BuildConfig**: Docker 映像建置參數
4. **MigrationConfig**: 資料庫 migration 設定
5. **VerificationCheck**: 部署後驗證機制

所有配置皆可透過 JSON 檔案管理，並使用環境變數和 Secret Manager 處理敏感資料，確保安全性和可維護性。

---

**文件版本**: 1.0
**建立日期**: 2025-11-08
**最後更新**: 2025-11-08
