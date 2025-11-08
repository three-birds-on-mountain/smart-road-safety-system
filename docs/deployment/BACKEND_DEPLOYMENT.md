# 後端部署手冊：智慧道路守護系統

**專案**：Smart Road Safety System Backend
**部署平台**：Google Cloud Run
**資料庫**：Cloud SQL PostgreSQL 15
**最後更新**：2025-11-08

---

## 目錄

1. [部署概述](#部署概述)
2. [前置需求](#前置需求)
3. [快速部署（5-10 分鐘）](#快速部署5-10-分鐘)
4. [詳細部署步驟](#詳細部署步驟)
5. [驗證部署](#驗證部署)
6. [常見問題排除](#常見問題排除)
7. [更新已部署的服務](#更新已部署的服務)
8. [監控與日誌](#監控與日誌)

---

## 部署概述

本手冊說明如何將智慧道路守護系統的後端 API 服務部署到 Google Cloud Run。

**部署架構**：
- **應用程式**：FastAPI (Python 3.12)
- **容器平台**：Google Cloud Run
- **資料庫**：Cloud SQL PostgreSQL 15
- **連線方式**：Unix Domain Socket (透過 Cloud SQL Proxy)
- **映像儲存**：Artifact Registry
- **建置工具**：Cloud Build

**關鍵特性**：
- ✅ 自動擴展（0-10 實例）
- ✅ 無伺服器架構
- ✅ HTTPS 自動配置
- ✅ 健康檢查端點
- ✅ 環境變數管理

---

## 前置需求

### 1. GCP 專案設定

**專案資訊**：
- 專案 ID：`three-birds-on-mountain`
- 區域：`asia-east1`
- Cloud SQL 實例：`tpml-seat-tracker-db`

**驗證專案設定**：
```bash
# 設定專案
gcloud config set project three-birds-on-mountain
gcloud config set compute/region asia-east1

# 驗證設定
gcloud config list
```

### 2. 必要工具

- **gcloud CLI**：Google Cloud 命令列工具
  ```bash
  # 驗證安裝
  gcloud --version

  # 登入
  gcloud auth login
  ```

- **Docker**（本地測試用，可選）
  ```bash
  docker --version
  ```

### 3. 啟用必要的 GCP API

```bash
# 啟用必要的 API
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### 4. 驗證資源存在

```bash
# 驗證 Cloud SQL 實例
gcloud sql instances describe tpml-seat-tracker-db

# 驗證 Artifact Registry
gcloud artifacts repositories list --location=asia-east1
```

---

## 快速部署（5-10 分鐘）

### 步驟 1：準備環境變數

```bash
# 建立環境變數檔案
cat > .env.deploy << 'EOF'
# 資料庫設定
DB_USER="road_safety_user"
DB_PASSWORD="YOUR_SECURE_PASSWORD_HERE"
DB_NAME="road_safety_db"

# API Keys
MAPBOX_TOKEN="YOUR_MAPBOX_TOKEN"

# GCP 設定
PROJECT_ID="three-birds-on-mountain"
REGION="asia-east1"
CLOUD_SQL_INSTANCE="tpml-seat-tracker-db"
EOF

# 將 .env.deploy 加入 .gitignore
echo ".env.deploy" >> .gitignore
```

**⚠️ 重要**：記得將 `YOUR_SECURE_PASSWORD_HERE` 替換為實際的密碼。

### 步驟 2：建立資料庫

```bash
# 載入環境變數
source .env.deploy

# 建立資料庫
gcloud sql databases create $DB_NAME \
  --instance=$CLOUD_SQL_INSTANCE \
  --charset=UTF8 \
  --collation=en_US.UTF8

# 建立使用者
gcloud sql users create $DB_USER \
  --instance=$CLOUD_SQL_INSTANCE \
  --password="$DB_PASSWORD"
```

### 步驟 3：建置並部署

```bash
# 建置 Docker 映像（使用 Cloud Build）
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest

# 部署到 Cloud Run
gcloud run deploy road-safety-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1 \
  --add-cloudsql-instances=three-birds-on-mountain:asia-east1:tpml-seat-tracker-db \
  --set-env-vars="DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@/road_safety_db?host=/cloudsql/three-birds-on-mountain:asia-east1:tpml-seat-tracker-db,CORS_ORIGINS=*,LOG_LEVEL=INFO" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --allow-unauthenticated
```

### 步驟 4：驗證部署

```bash
# 取得服務 URL
BACKEND_URL=$(gcloud run services describe road-safety-backend \
  --region=asia-east1 --format="value(status.url)")

echo "後端 URL: $BACKEND_URL"

# 測試 health endpoint
curl $BACKEND_URL/api/v1/health
```

**預期輸出**：
```json
{
    "status": "healthy",
    "timestamp": "2025-11-08T07:21:11.105738",
    "database": "connected"
}
```

---

## 詳細部署步驟

### 步驟 1：檢查 Dockerfile

確認 `backend/Dockerfile` 使用正確的 PORT 設定：

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# 安裝 uv
RUN pip install uv

# 複製專案檔案
COPY pyproject.toml ./
COPY alembic.ini ./

# 安裝依賴
RUN uv pip install --system -e .

# 複製原始碼
COPY src/ ./src/

# 暴露端口（Cloud Run 使用 PORT 環境變數）
EXPOSE 8080

# 啟動應用程式（使用 PORT 環境變數，預設 8080）
CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8080}
```

**關鍵點**：
- ✅ 使用 `${PORT:-8080}` 環境變數
- ✅ 不要硬編碼 port 號碼
- ✅ 使用 `uv` 快速安裝依賴

### 步驟 2：建置 Docker 映像

使用 Cloud Build 建置映像：

```bash
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest
```

**建置過程說明**：
1. 上傳本地程式碼到 Cloud Storage
2. 在 Cloud Build 中執行 Docker build
3. 推送映像到 Artifact Registry
4. 預計時間：1-2 分鐘

**查看建置狀態**：
```bash
gcloud builds list --limit=5
```

### 步驟 3：設定環境變數

部署時需要設定以下環境變數：

| 環境變數 | 用途 | 範例值 |
|---------|------|--------|
| DATABASE_URL | 資料庫連線字串 | `postgresql://user:pass@/dbname?host=/cloudsql/...` |
| CORS_ORIGINS | CORS 允許的來源 | `*` 或 `https://frontend-url` |
| LOG_LEVEL | 日誌等級 | `INFO` 或 `DEBUG` |

**DATABASE_URL 格式說明**：
```
postgresql://[使用者]:[密碼]@/[資料庫名稱]?host=/cloudsql/[專案ID]:[區域]:[實例名稱]
```

範例：
```
postgresql://road_safety_user:SecurePass123@/road_safety_db?host=/cloudsql/three-birds-on-mountain:asia-east1:tpml-seat-tracker-db
```

### 步驟 4：部署到 Cloud Run

完整的部署指令：

```bash
gcloud run deploy road-safety-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1 \
  --add-cloudsql-instances=three-birds-on-mountain:asia-east1:tpml-seat-tracker-db \
  --set-env-vars="DATABASE_URL=postgresql://road_safety_user:PASSWORD@/road_safety_db?host=/cloudsql/three-birds-on-mountain:asia-east1:tpml-seat-tracker-db,CORS_ORIGINS=*,LOG_LEVEL=INFO" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --allow-unauthenticated
```

**參數說明**：

| 參數 | 說明 |
|------|------|
| `--image` | Docker 映像位置 |
| `--region` | 部署區域 |
| `--add-cloudsql-instances` | 連接的 Cloud SQL 實例 |
| `--set-env-vars` | 設定環境變數 |
| `--memory` | 記憶體限制（512Mi） |
| `--cpu` | CPU 限制（1 core） |
| `--min-instances` | 最小實例數（0 = 可縮減到零） |
| `--max-instances` | 最大實例數（10） |
| `--port` | 容器監聽的 port（8080） |
| `--allow-unauthenticated` | 允許未驗證的存取 |

**部署時間**：約 1-2 分鐘

---

## 驗證部署

### 1. 檢查服務狀態

```bash
# 查看服務詳細資訊
gcloud run services describe road-safety-backend --region=asia-east1

# 查看服務 URL
gcloud run services describe road-safety-backend \
  --region=asia-east1 --format="value(status.url)"
```

### 2. 測試 Health Endpoint

```bash
# 取得服務 URL
BACKEND_URL=$(gcloud run services describe road-safety-backend \
  --region=asia-east1 --format="value(status.url)")

# 測試 health endpoint
curl $BACKEND_URL/api/v1/health | jq
```

**預期輸出**：
```json
{
  "status": "healthy",
  "timestamp": "2025-11-08T07:21:11.105738",
  "database": "connected"
}
```

**驗證重點**：
- ✅ HTTP 狀態碼：200
- ✅ `status`: "healthy"
- ✅ `database`: "connected"
- ✅ 回應時間 < 2 秒

### 3. 測試 API Endpoints

```bash
# 測試 API 文件
curl $BACKEND_URL/docs

# 測試 hotspots API（需要有資料）
curl "$BACKEND_URL/api/v1/hotspots/nearby?lat=25.033&lng=121.5654&radius=1000" | jq
```

### 4. 檢查環境變數

```bash
# 查看設定的環境變數
gcloud run services describe road-safety-backend \
  --region=asia-east1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### 5. 驗證 Cloud SQL 連線

```bash
# 檢查 Cloud SQL 實例連接設定
gcloud run services describe road-safety-backend \
  --region=asia-east1 \
  --format="value(spec.template.metadata.annotations[run.googleapis.com/cloudsql-instances])"
```

---

## 常見問題排除

### Q1: 部署失敗 - 容器啟動失敗

**錯誤訊息**：
```
The user-provided container failed to start and listen on the port defined by the PORT=8080 environment variable
```

**原因**：Dockerfile 中的 CMD 使用固定 port，沒有使用 PORT 環境變數

**解決方式**：
1. 修改 `backend/Dockerfile` 的 CMD 為：
   ```dockerfile
   CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8080}
   ```

2. 重新建置並部署：
   ```bash
   gcloud builds submit --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest
   gcloud run deploy road-safety-backend --image=... --port=8080
   ```

### Q2: 資料庫連線失敗

**錯誤訊息**：health endpoint 回應 `"database": "disconnected"`

**排查步驟**：

1. **檢查 DATABASE_URL 格式**：
   ```bash
   gcloud run services describe road-safety-backend \
     --region=asia-east1 \
     --format="value(spec.template.spec.containers[0].env)" | grep DATABASE_URL
   ```

2. **驗證 Cloud SQL 實例連接**：
   ```bash
   gcloud run services describe road-safety-backend \
     --region=asia-east1 \
     --format="value(spec.template.metadata.annotations)"
   ```

   應該包含：`run.googleapis.com/cloudsql-instances: three-birds-on-mountain:asia-east1:tpml-seat-tracker-db`

3. **檢查資料庫和使用者是否存在**：
   ```bash
   gcloud sql databases list --instance=tpml-seat-tracker-db
   gcloud sql users list --instance=tpml-seat-tracker-db
   ```

4. **測試密碼是否正確**（透過 Cloud SQL Proxy 本地測試）：
   ```bash
   cloud-sql-proxy three-birds-on-mountain:asia-east1:tpml-seat-tracker-db &
   psql -h 127.0.0.1 -U road_safety_user -d road_safety_db
   ```

**常見修正方式**：
```bash
# 重設環境變數
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --set-env-vars="DATABASE_URL=postgresql://USER:PASS@/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE"
```

### Q3: CORS 錯誤

**錯誤**：前端呼叫後端時出現 CORS policy error

**解決方式**：
```bash
# 更新 CORS_ORIGINS 環境變數
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --set-env-vars="CORS_ORIGINS=https://your-frontend-url.run.app"

# 或允許所有來源（僅限開發環境）
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --set-env-vars="CORS_ORIGINS=*"
```

### Q4: 記憶體不足 (OOM)

**錯誤**：服務崩潰，日誌顯示 Out of Memory

**解決方式**：
```bash
# 增加記憶體限制
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --memory=1Gi
```

**建議記憶體配置**：
- 開發環境：256Mi
- 一般使用：512Mi（預設）
- 高負載：1Gi 或 2Gi

### Q5: 冷啟動時間過長

**問題**：服務閒置後首次請求需要等待很久

**解決方式**：
```bash
# 設定最小實例數為 1（保持至少一個實例運行）
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --min-instances=1
```

**⚠️ 注意**：設定 min-instances > 0 會增加成本

### Q6: Artifact Registry 找不到 repository

**錯誤**：`repository not found`

**解決方式**：
```bash
# 建立 Artifact Registry repository
gcloud artifacts repositories create containers \
  --repository-format=docker \
  --location=asia-east1 \
  --description="Docker images for Road Safety System"

# 驗證
gcloud artifacts repositories list --location=asia-east1
```

---

## 更新已部署的服務

### 1. 更新程式碼

```bash
# 1. 修改程式碼後，重新建置映像
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest

# 2. 部署新版本
gcloud run deploy road-safety-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1
```

**滾動更新**：Cloud Run 自動執行零停機時間的滾動更新

### 2. 只更新環境變數

```bash
# 更新單一環境變數
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="LOG_LEVEL=DEBUG"

# 更新多個環境變數
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="LOG_LEVEL=DEBUG,CORS_ORIGINS=https://new-frontend.com"

# 移除環境變數
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --remove-env-vars="OLD_VAR"
```

### 3. 調整資源配置

```bash
# 調整記憶體和 CPU
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --memory=1Gi \
  --cpu=2

# 調整自動擴展參數
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --min-instances=1 \
  --max-instances=20
```

### 4. 回滾到上一版本

```bash
# 1. 查看所有版本
gcloud run revisions list --service=road-safety-backend --region=asia-east1

# 2. 回滾到特定版本
gcloud run services update-traffic road-safety-backend \
  --region=asia-east1 \
  --to-revisions=road-safety-backend-00001=100
```

---

## 監控與日誌

### 1. 查看服務日誌

```bash
# 查看最近 50 條日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-backend" \
  --limit=50 \
  --format=json | jq -r '.[] | .textPayload // .jsonPayload.message'

# 只看錯誤日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-backend AND severity>=ERROR" \
  --limit=20

# 即時追蹤日誌（類似 tail -f）
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-backend" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

### 2. 查看服務指標

```bash
# 在 GCP Console 查看
echo "https://console.cloud.google.com/run/detail/asia-east1/road-safety-backend/metrics?project=three-birds-on-mountain"

# 使用 gcloud 查看請求數
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count" AND resource.labels.service_name="road-safety-backend"'
```

**關鍵指標**：
- Request count（請求數）
- Request latencies（延遲）
- Container CPU utilization（CPU 使用率）
- Container memory utilization（記憶體使用率）
- Container instance count（實例數）

### 3. 設定告警

```bash
# 建立 CPU 使用率告警（需先建立 notification channel）
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Road Safety Backend High CPU" \
  --condition-threshold-value=0.8 \
  --condition-display-name="CPU > 80%" \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="road-safety-backend" AND metric.type="run.googleapis.com/container/cpu/utilizations"'
```

### 4. 查看部署歷史

```bash
# 查看所有版本
gcloud run revisions list --service=road-safety-backend --region=asia-east1

# 查看特定版本詳細資訊
gcloud run revisions describe road-safety-backend-00002-mnl --region=asia-east1
```

---

## 附錄

### A. 完整的環境變數列表

| 變數名稱 | 必填 | 說明 | 預設值 |
|---------|------|------|--------|
| DATABASE_URL | ✅ | PostgreSQL 連線字串 | - |
| CORS_ORIGINS | ✅ | CORS 允許的來源 | `*` |
| LOG_LEVEL | ○ | 日誌等級 | `INFO` |
| PORT | ○ | HTTP 監聽 port | `8080` |

### B. 資源限制建議

| 環境 | Memory | CPU | Min Instances | Max Instances |
|------|--------|-----|---------------|---------------|
| 開發 | 256Mi | 1 | 0 | 3 |
| 測試 | 512Mi | 1 | 0 | 5 |
| 生產 | 512Mi-1Gi | 1-2 | 1 | 10-20 |

### C. 成本估算

**Cloud Run 計費方式**：
- 按請求數計費
- 按 CPU 和記憶體使用時間計費
- 閒置時（min-instances=0）不計費

**預估成本**（asia-east1 區域，512Mi 記憶體，1 CPU）：
- 低流量（<1000 請求/天）：約 $0-5 USD/月
- 中流量（1000-10000 請求/天）：約 $5-20 USD/月
- 高流量（>10000 請求/天）：需根據實際使用量計算

**成本優化建議**：
1. 設定 `min-instances=0`（閒置時不計費）
2. 使用適當的記憶體限制（不要過度配置）
3. 啟用請求快取減少資料庫查詢

### D. 安全最佳實踐

1. **環境變數管理**：
   - ✅ 使用 Secret Manager 儲存敏感資料
   - ✅ 不要在程式碼中硬編碼密碼
   - ✅ 將 `.env.deploy` 加入 `.gitignore`

2. **存取控制**：
   - 生產環境移除 `--allow-unauthenticated`
   - 使用 Cloud IAM 控制存取權限
   - 設定 CORS 只允許特定來源

3. **資料庫安全**：
   - 使用強密碼
   - 定期更新密碼
   - 限制資料庫使用者權限

### E. 相關連結

- [Cloud Run 官方文件](https://cloud.google.com/run/docs)
- [Cloud SQL 連接指南](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Artifact Registry 文件](https://cloud.google.com/artifact-registry/docs)
- [專案 GitHub](https://github.com/your-org/smart-road-safety-system)

---

## 部署檢查清單

在完成部署前，請確認以下項目：

- [ ] GCP 專案設定正確（`three-birds-on-mountain`）
- [ ] Cloud SQL 實例運行中（`tpml-seat-tracker-db`）
- [ ] 資料庫和使用者已建立（`road_safety_db`, `road_safety_user`）
- [ ] Artifact Registry repository 已建立（`containers`）
- [ ] Dockerfile 使用 PORT 環境變數
- [ ] 環境變數已正確設定（DATABASE_URL, CORS_ORIGINS）
- [ ] Docker 映像建置成功
- [ ] Cloud Run 服務部署成功
- [ ] Health endpoint 回應 `"status": "healthy"`
- [ ] 資料庫連線正常（`"database": "connected"`）
- [ ] API 文件可存取（`/docs`）
- [ ] `.env.deploy` 已加入 `.gitignore`

---

**文件版本**：1.0
**最後更新**：2025-11-08
**維護者**：Smart Road Safety Team
