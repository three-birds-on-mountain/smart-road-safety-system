# 快速部署指南：Google Cloud Run

**功能**: Google Cloud Run 部署
**日期**: 2025-11-08
**相關**: [spec.md](./spec.md) | [plan.md](./plan.md) | [research.md](./research.md)

## 概述

本指南提供快速部署智慧道路守護系統到 Google Cloud Run 的步驟。整個流程約需 15-20 分鐘。

**前置需求**:
- Google Cloud 帳號
- gcloud CLI 已安裝
- 專案 ID: `three-birds-on-mountain`
- 現有 Cloud SQL 實例: `tpml-seat-tracker-db`

---

## 快速開始（5 分鐘）

### 步驟 1: 設定環境

```bash
# 1. 設定專案和區域
gcloud config set project three-birds-on-mountain
gcloud config set compute/region asia-east1

# 2. 驗證設定
gcloud config list

# 3. 確認 Cloud SQL 實例存在
gcloud sql instances describe tpml-seat-tracker-db
```

### 步驟 2: 準備環境變數

```bash
# 建立環境變數檔案（不要提交到 git）
cat > .env.deploy << 'EOF'
# 資料庫設定
DB_USER="road_safety_user"
DB_PASSWORD="YOUR_DB_PASSWORD_HERE"
DB_NAME="road_safety_db"

# API Keys
GOOGLE_MAPS_API_KEY="YOUR_MAPS_API_KEY"
MAPBOX_TOKEN="YOUR_MAPBOX_TOKEN"
EOF

# 載入環境變數
source .env.deploy
```

**⚠️ 重要**: 將 `.env.deploy` 加入 `.gitignore`

### 步驟 3: 執行完整部署

```bash
# 一鍵部署（migration + backend + frontend）
./scripts/deploy/deploy-all.sh
```

部署完成後會顯示：
```
✓ 部署流程全部完成！

後端 URL: https://road-safety-backend-xxx.asia-east1.run.app
前端 URL: https://road-safety-frontend-xxx.asia-east1.run.app

API 文件: https://road-safety-backend-xxx.asia-east1.run.app/docs
```

---

## 手動部署（分步驟）

如果你想分步驟執行部署，或需要更細緻的控制：

### 步驟 1: 建立資料庫和使用者

```bash
# 1. 建立資料庫
gcloud sql databases create road_safety_db \
  --instance=tpml-seat-tracker-db \
  --charset=UTF8 \
  --collation=en_US.UTF8

# 2. 建立使用者
gcloud sql users create road_safety_user \
  --instance=tpml-seat-tracker-db \
  --password="$DB_PASSWORD"
```

### 步驟 2: 執行資料庫 Migration

```bash
# 安裝 Cloud SQL Proxy（如未安裝）
# macOS ARM64
curl -o cloud-sql-proxy \
  https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/

# 執行 migration
./scripts/deploy/run-migration.sh

# 驗證 migration
# 腳本會自動驗證，或手動執行：
cd backend
export DATABASE_URL="postgresql+psycopg2://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME"
cloud-sql-proxy --port 5432 three-birds-on-mountain:asia-east1:tpml-seat-tracker-db &
alembic current
kill %1
```

### 步驟 3: 部署後端

```bash
# 部署後端服務
./scripts/deploy/deploy-backend.sh

# 或手動執行：
cd backend

# 建置映像
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest

# 部署到 Cloud Run
gcloud run deploy road-safety-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1 \
  --add-cloudsql-instances=three-birds-on-mountain:asia-east1:tpml-seat-tracker-db \
  --update-env-vars="DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@/road_safety_db?host=/cloudsql/three-birds-on-mountain:asia-east1:tpml-seat-tracker-db" \
  --update-env-vars="CORS_ORIGINS=*" \
  --update-env-vars="LOG_LEVEL=INFO" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated

# 取得後端 URL
BACKEND_URL=$(gcloud run services describe road-safety-backend \
  --region=asia-east1 --format="value(status.url)")
echo "後端 URL: $BACKEND_URL"
```

### 步驟 4: 驗證後端

```bash
# 驗證 health endpoint
curl $BACKEND_URL/api/v1/health | jq

# 預期輸出：
# {
#   "status": "healthy",
#   "database": "connected",
#   ...
# }

# 測試 API endpoint
curl "$BACKEND_URL/api/v1/hotspots/nearby?lat=25.033&lng=121.5654&radius=1000" | jq
```

### 步驟 5: 建立前端建置檔案

前端需要以下檔案（如果還沒有）：

1. **frontend/Dockerfile**:
```dockerfile
# Build stage
FROM node:20-alpine as builder
WORKDIR /app
ARG API_URL
ARG MAPBOX_TOKEN
ENV VITE_API_URL=$API_URL
ENV VITE_MAPBOX_TOKEN=$MAPBOX_TOKEN
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

2. **frontend/cloudbuild.yaml**:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'API_URL=${_API_URL}'
      - '--build-arg'
      - 'MAPBOX_TOKEN=${_MAPBOX_TOKEN}'
      - '-t'
      - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:latest'
      - '.'
images:
  - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:latest'
```

3. **frontend/docker/nginx.conf**:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 步驟 6: 部署前端

```bash
# 部署前端服務
./scripts/deploy/deploy-frontend.sh

# 或手動執行：
cd frontend

# 建置映像（注入環境變數）
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_API_URL="$BACKEND_URL",_MAPBOX_TOKEN="$MAPBOX_TOKEN"

# 部署到 Cloud Run
gcloud run deploy road-safety-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1 \
  --port=80 \
  --memory=256Mi \
  --allow-unauthenticated

# 取得前端 URL
FRONTEND_URL=$(gcloud run services describe road-safety-frontend \
  --region=asia-east1 --format="value(status.url)")
echo "前端 URL: $FRONTEND_URL"
```

### 步驟 7: 更新後端 CORS 設定

```bash
# 更新後端允許前端 URL
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="CORS_ORIGINS=$FRONTEND_URL"
```

### 步驟 8: 驗證部署

```bash
# 驗證後端
curl $BACKEND_URL/api/v1/health | jq

# 驗證前端
curl -I $FRONTEND_URL

# 驗證整合（CORS）
curl -H "Origin: $FRONTEND_URL" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     $BACKEND_URL/api/v1/health -i

# 應該看到 Access-Control-Allow-Origin 標頭
```

---

## 常見問題

### Q1: 資料庫連線失敗

**錯誤**: `database: "disconnected"` in health endpoint

**解決方式**:
```bash
# 1. 檢查 Cloud SQL 實例狀態
gcloud sql instances describe tpml-seat-tracker-db

# 2. 檢查 DATABASE_URL 格式
gcloud run services describe road-safety-backend \
  --format="value(spec.template.spec.containers[0].env)"

# 3. 驗證 --add-cloudsql-instances 參數
gcloud run services describe road-safety-backend \
  --format="value(spec.template.metadata.annotations)"
```

### Q2: 前端無法呼叫後端（CORS 錯誤）

**錯誤**: CORS policy error in browser console

**解決方式**:
```bash
# 確認後端 CORS_ORIGINS 包含前端 URL
gcloud run services describe road-safety-backend \
  --format="value(spec.template.spec.containers[0].env[CORS_ORIGINS])"

# 更新 CORS 設定
gcloud run services update road-safety-backend \
  --update-env-vars="CORS_ORIGINS=https://frontend-url"
```

### Q3: Cloud Build 建置失敗

**錯誤**: Artifact Registry repository not found

**解決方式**:
```bash
# 建立 Artifact Registry repository
gcloud artifacts repositories create containers \
  --repository-format=docker \
  --location=asia-east1 \
  --description="Docker images for Road Safety System"

# 驗證
gcloud artifacts repositories list --location=asia-east1
```

### Q4: 前端環境變數未注入

**錯誤**: API_URL is undefined in frontend

**解決方式**:
```bash
# 確認 cloudbuild.yaml 使用 --build-arg
# 確認 Dockerfile 使用 ARG 和 ENV
# 重新建置並指定 substitutions
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_API_URL="https://backend-url",_MAPBOX_TOKEN="pk.xxx"
```

### Q5: Migration 失敗

**錯誤**: Alembic migration error

**解決方式**:
```bash
# 1. 檢查當前版本
alembic current

# 2. 查看 migration 歷史
alembic history

# 3. 降級到上一版（如需要）
alembic downgrade -1

# 4. 重新升級
alembic upgrade head

# 5. 如果 migration 檔案有問題，修正後重新生成
alembic revision --autogenerate -m "description"
```

---

## 更新已部署的服務

### 更新後端程式碼

```bash
cd backend

# 重新建置並部署
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest

gcloud run deploy road-safety-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1
```

### 更新前端程式碼

```bash
cd frontend

# 重新建置並部署
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_API_URL="$BACKEND_URL",_MAPBOX_TOKEN="$MAPBOX_TOKEN"

gcloud run deploy road-safety-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1
```

### 更新環境變數

```bash
# 只更新環境變數（不重新部署程式碼）
gcloud run services update road-safety-backend \
  --update-env-vars="LOG_LEVEL=DEBUG"

# 移除環境變數
gcloud run services update road-safety-backend \
  --remove-env-vars="OLD_VAR"
```

### 執行新的 Migration

```bash
# 1. 建立新的 migration
cd backend
alembic revision --autogenerate -m "add new table"

# 2. 審查 migration 檔案
# 檢查 backend/alembic/versions/xxx_add_new_table.py

# 3. 執行 migration
./scripts/deploy/run-migration.sh
```

---

## 監控和日誌

### 查看服務狀態

```bash
# 後端狀態
gcloud run services describe road-safety-backend --region=asia-east1

# 前端狀態
gcloud run services describe road-safety-frontend --region=asia-east1

# 列出所有服務
gcloud run services list --region=asia-east1
```

### 查看日誌

```bash
# 後端日誌（最近 50 條）
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-backend" \
  --limit 50 \
  --format json | jq -r '.[] | .textPayload // .jsonPayload.message'

# 只看錯誤
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-backend AND severity>=ERROR" \
  --limit 20

# 前端日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend" \
  --limit 50
```

### 查看指標

```bash
# CPU 使用率
gcloud monitoring time-series list \
  --filter='resource.labels.service_name="road-safety-backend"' \
  --aggregation=aligner.rate

# 請求數
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"'
```

---

## 清理資源（可選）

如果你想要刪除部署的服務：

```bash
# 刪除後端服務
gcloud run services delete road-safety-backend --region=asia-east1

# 刪除前端服務
gcloud run services delete road-safety-frontend --region=asia-east1

# 刪除 Docker 映像（可選）
gcloud artifacts docker images delete \
  asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest

gcloud artifacts docker images delete \
  asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest

# 注意：不要刪除 Cloud SQL 實例（共用）
```

---

## 下一步

部署完成後，建議：

1. **設定自定義網域**（可選）:
   ```bash
   gcloud run services add-iam-policy-binding road-safety-frontend \
     --member=allUsers \
     --role=roles/run.invoker

   gcloud beta run domain-mappings create \
     --service road-safety-frontend \
     --domain your-domain.com
   ```

2. **設定 CI/CD**:
   - 參考 `.github/workflows/` 範例
   - 或使用 Cloud Build triggers

3. **設定監控告警**:
   ```bash
   # 範例：建立 CPU 使用率告警
   gcloud alpha monitoring policies create \
     --notification-channels=CHANNEL_ID \
     --display-name="Cloud Run High CPU" \
     --condition-threshold-value=0.8
   ```

4. **啟用 Cloud SQL 備份**（已有預設備份）

5. **審查安全設定**:
   - 確認 CORS origins 限制
   - 設定 Secret Manager 權限
   - 檢查 IAM 角色

---

## 參考資料

- [完整部署指南](./research.md)
- [資料模型](./data-model.md)
- [部署 API 合約](./contracts/deployment-api.md)
- [驗證 API 合約](./contracts/verification-api.md)

---

**文件版本**: 1.0
**建立日期**: 2025-11-08
**預估完成時間**: 15-20 分鐘
