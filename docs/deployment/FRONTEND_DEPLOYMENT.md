# 前端部署完整手冊

**專案**：Smart Road Safety System Frontend
**最後更新**：2025-11-08
**目標平台**：Google Cloud Run

---

## 目錄

1. [部署概述](#部署概述)
2. [前置準備](#前置準備)
3. [環境變數設定](#環境變數設定)
4. [Docker 設定](#docker-設定)
5. [建置與部署步驟](#建置與部署步驟)
6. [驗證部署](#驗證部署)
7. [常見問題與解決方案](#常見問題與解決方案)
8. [維護與更新](#維護與更新)

---

## 部署概述

### 架構說明

前端採用以下技術堆疊：
- **框架**：React 19.1 + Vite
- **語言**：TypeScript 5.9
- **UI 函式庫**：Element Plus
- **地圖服務**：Mapbox GL
- **容器化**：Docker (Multi-stage build)
- **Web 伺服器**：Nginx (Alpine)
- **部署平台**：Google Cloud Run

### 部署流程

```mermaid
graph LR
    A[原始碼] --> B[Cloud Build]
    B --> C[Docker Image]
    C --> D[Artifact Registry]
    D --> E[Cloud Run]
```

### 已部署服務資訊

- **服務名稱**：`road-safety-frontend`
- **服務 URL**：https://road-safety-frontend-303764303193.asia-east1.run.app
- **區域**：asia-east1
- **專案 ID**：three-birds-on-mountain

---

## 前置準備

### 1. 確認 GCP 專案設定

```bash
# 設定專案
gcloud config set project three-birds-on-mountain
gcloud config set compute/region asia-east1

# 確認當前設定
gcloud config list
```

### 2. 確認必要的 GCP API 已啟用

```bash
# 啟用必要的 API
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 3. 確認 Artifact Registry 已建立

```bash
# 列出現有的 repository
gcloud artifacts repositories list --location=asia-east1

# 如果沒有 containers repository，建立一個
gcloud artifacts repositories create containers \
  --repository-format=docker \
  --location=asia-east1 \
  --description="Docker images for Smart Road Safety System"
```

### 4. 確認後端已部署

前端需要後端 API，請確認：
- 後端服務 URL：https://road-safety-backend-303764303193.asia-east1.run.app
- 後端健康檢查正常：`curl https://road-safety-backend-303764303193.asia-east1.run.app/api/v1/health`

---

## 環境變數設定

### 建置時環境變數

這些變數會在 Docker 建置時注入，並編譯進前端程式碼中。

| 變數名稱 | 說明 | 範例值 |
|---------|------|--------|
| `VITE_API_BASE_URL` | 後端 API 基礎 URL | `https://road-safety-backend-303764303193.asia-east1.run.app/api/v1` |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox 存取權杖 | `pk.eyJ1...` |
| `VITE_USE_MOCK_API` | 是否使用 Mock API | `false` |
| `VITE_FALLBACK_TO_MOCK` | 失敗時是否回退到 Mock | `false` |
| `VITE_DISABLE_MOCK_PREVIEW` | 停用 Mock 預覽 | `true` |

### 執行時環境變數

| 變數名稱 | 說明 | 預設值 |
|---------|------|--------|
| `PORT` | Nginx 監聽 Port | `8080` |

---

## Docker 設定

### Dockerfile 架構

前端使用多階段建置（Multi-stage build）：

1. **Builder Stage**：使用 Node.js 20 Alpine 建置前端
2. **Production Stage**：使用 Nginx Alpine 服務靜態檔案

### 關鍵設定說明

#### 1. Multi-stage Build

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# 接收建置時的環境變數
ARG VITE_API_BASE_URL
ARG VITE_MAPBOX_ACCESS_TOKEN

# 設定環境變數（Vite 建置時會讀取）
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAPBOX_ACCESS_TOKEN=$VITE_MAPBOX_ACCESS_TOKEN

# ⚠️ 重要：確保不使用 mock 資料
ENV VITE_USE_MOCK_API=false
ENV VITE_FALLBACK_TO_MOCK=false
ENV VITE_DISABLE_MOCK_PREVIEW=true

# 安裝依賴並建置
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
```

#### 2. Nginx Production Stage

```dockerfile
# Production stage
FROM nginx:alpine

# 安裝 gettext 套件（提供 envsubst）
RUN apk add --no-cache gettext

# 複製建置產物
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製 nginx 設定範本
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template

# 設定預設 PORT
ENV PORT=8080

# 暴露 port（Cloud Run 會動態設定）
EXPOSE 8080

# 啟動 nginx（envsubst 會自動替換 $PORT）
CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
```

### Nginx 設定

位置：`frontend/docker/nginx.conf`

```nginx
server {
    listen $PORT default_server;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 壓縮
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
    gzip_disable "MSIE [1-6]\.";

    # SPA 路由 - 所有請求都轉到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全標頭
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # 靜態資源快取（assets 目錄）
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 禁止存取隱藏檔案
    location ~ /\. {
        deny all;
    }

    # 健康檢查端點
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Cloud Build 設定

位置：`frontend/cloudbuild.yaml`

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'VITE_API_BASE_URL=${_VITE_API_BASE_URL}'
      - '--build-arg'
      - 'VITE_MAPBOX_ACCESS_TOKEN=${_VITE_MAPBOX_ACCESS_TOKEN}'
      - '-t'
      - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:latest'
      - '.'

images:
  - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:latest'

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'N1_HIGHCPU_8'
```

---

## 建置與部署步驟

### 方法一：使用 Cloud Build（推薦）

#### 步驟 1：建置 Docker 映像

```bash
# 切換到前端目錄
cd frontend

# 使用 Cloud Build 建置映像
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_VITE_API_BASE_URL="https://road-safety-backend-303764303193.asia-east1.run.app/api/v1",_VITE_MAPBOX_ACCESS_TOKEN="你的_MAPBOX_TOKEN"
```

**預期輸出**：
```
Creating temporary archive...
Uploading tarball...
BUILD SUCCESS
STATUS: SUCCESS
```

**建置時間**：約 60-70 秒

#### 步驟 2：部署到 Cloud Run

```bash
gcloud run deploy road-safety-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1 \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated
```

**預期輸出**：
```
Deploying container to Cloud Run service [road-safety-frontend]...
✓ Deploying... Done.
✓ Creating Revision...
✓ Routing traffic...
Done.
Service [road-safety-frontend] revision [road-safety-frontend-00001-xxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://road-safety-frontend-303764303193.asia-east1.run.app
```

#### 步驟 3：更新後端 CORS 設定

```bash
# 切換到後端目錄
cd ../backend

# 更新後端 CORS 設定以允許前端訪問
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="CORS_ORIGINS=https://road-safety-frontend-303764303193.asia-east1.run.app"
```

### 方法二：本地建置後推送

```bash
# 1. 本地建置 Docker 映像
docker build \
  --build-arg VITE_API_BASE_URL="https://road-safety-backend-303764303193.asia-east1.run.app/api/v1" \
  --build-arg VITE_MAPBOX_ACCESS_TOKEN="你的_MAPBOX_TOKEN" \
  -t asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  .

# 2. 設定 Docker 認證
gcloud auth configure-docker asia-east1-docker.pkg.dev

# 3. 推送映像
docker push asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest

# 4. 部署（同上）
gcloud run deploy road-safety-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1 \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated
```

---

## 驗證部署

### 1. 檢查服務狀態

```bash
gcloud run services describe road-safety-frontend --region=asia-east1
```

### 2. 測試健康檢查端點

```bash
# 測試首頁
curl -I https://road-safety-frontend-303764303193.asia-east1.run.app

# 測試健康檢查
curl https://road-safety-frontend-303764303193.asia-east1.run.app/health
```

**預期輸出**：
```
HTTP/2 200
content-type: text/plain
...

healthy
```

### 3. 取得服務 URL

```bash
gcloud run services describe road-safety-frontend \
  --region=asia-east1 \
  --format="value(status.url)"
```

### 4. 查看最近的日誌

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend" \
  --limit=50 \
  --format=json
```

### 5. 瀏覽器測試

開啟瀏覽器訪問：
```
https://road-safety-frontend-303764303193.asia-east1.run.app
```

**檢查項目**：
- ✅ 頁面正常載入
- ✅ 地圖顯示正常
- ✅ Network 標籤顯示 API 請求指向真實後端（不是 mock）
- ✅ 沒有 CORS 錯誤
- ✅ 沒有 Console 錯誤

---

## 常見問題與解決方案

### 問題 1：容器啟動失敗 - PORT 環境變數錯誤

**錯誤訊息**：
```
The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable
```

**原因**：
- Nginx 沒有監聽動態的 PORT 環境變數
- 缺少 `envsubst` 工具

**解決方案**：

1. 確認 Dockerfile 已安裝 `gettext` 套件：
```dockerfile
RUN apk add --no-cache gettext
```

2. 確認 CMD 使用 envsubst：
```dockerfile
CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
```

3. 確認 nginx.conf 使用 `$PORT` 變數：
```nginx
listen $PORT default_server;
```

### 問題 2：Nginx 設定語法錯誤

**錯誤訊息**：
```
nginx: [emerg] invalid value "must-revalidate" in /etc/nginx/conf.d/default.conf:11
```

**原因**：
- `gzip_proxied` 指令不支援 `must-revalidate` 參數

**解決方案**：

修改 `nginx.conf`：
```nginx
# 錯誤
gzip_proxied expired no-cache no-store private must-revalidate auth;

# 正確
gzip_proxied expired no-cache no-store private auth;
```

### 問題 3：前端呼叫後端 API 出現 CORS 錯誤

**錯誤訊息**（瀏覽器 Console）：
```
Access to fetch at 'https://road-safety-backend-...' from origin 'https://road-safety-frontend-...' has been blocked by CORS policy
```

**原因**：
- 後端 CORS 設定未包含前端 URL

**解決方案**：

更新後端 CORS 設定：
```bash
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="CORS_ORIGINS=https://road-safety-frontend-303764303193.asia-east1.run.app"
```

或者在開發階段使用萬用字元（⚠️ 生產環境不建議）：
```bash
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="CORS_ORIGINS=*"
```

### 問題 4：前端還是使用 Mock 資料

**檢查方式**：
- 開啟瀏覽器開發者工具 → Network 標籤
- 檢查 API 請求是否指向真實後端 URL

**原因**：
- 建置時環境變數設定錯誤
- Mock 相關環境變數未正確停用

**解決方案**：

1. 確認 Dockerfile 中有以下設定：
```dockerfile
ENV VITE_USE_MOCK_API=false
ENV VITE_FALLBACK_TO_MOCK=false
ENV VITE_DISABLE_MOCK_PREVIEW=true
```

2. 確認 Cloud Build 傳入正確的 API URL：
```bash
--substitutions=_VITE_API_BASE_URL="https://road-safety-backend-303764303193.asia-east1.run.app/api/v1"
```

3. 重新建置並部署。

### 問題 5：Cloud Build 建置失敗

**錯誤訊息**：
```
INVALID_ARGUMENT: invalid build: invalid image name
```

**原因**：
- `cloudbuild.yaml` 中使用了不存在的變數（如 `${SHORT_SHA}`）

**解決方案**：

修改 `cloudbuild.yaml`，移除未定義的變數：
```yaml
images:
  - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:latest'
  # 移除這行：
  # - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:${SHORT_SHA}'
```

### 問題 6：部署超時

**錯誤訊息**：
```
Deployment timeout
```

**可能原因**：
- npm install 過慢
- 網路問題
- 建置步驟過於複雜

**解決方案**：

1. 使用 `npm ci` 代替 `npm install`（已在 Dockerfile 中使用）

2. 增加 Cloud Build 的機器效能：
```yaml
options:
  machineType: 'N1_HIGHCPU_8'  # 使用更高效能的機器
```

3. 設定更長的超時時間：
```bash
gcloud builds submit --timeout=20m ...
```

---

## 維護與更新

### 更新前端程式碼

```bash
# 1. 重新建置映像
cd frontend
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_VITE_API_BASE_URL="https://road-safety-backend-303764303193.asia-east1.run.app/api/v1",_VITE_MAPBOX_ACCESS_TOKEN="你的_MAPBOX_TOKEN"

# 2. 重新部署（使用相同指令）
gcloud run deploy road-safety-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1
```

### 更新環境變數（僅執行時變數）

```bash
gcloud run services update road-safety-frontend \
  --region=asia-east1 \
  --update-env-vars="新變數名稱=新值"
```

⚠️ **注意**：Vite 環境變數（如 `VITE_API_BASE_URL`）是建置時變數，修改需要重新建置映像。

### 查看當前環境變數

```bash
gcloud run services describe road-safety-frontend \
  --region=asia-east1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### 回滾到前一版本

```bash
# 1. 列出所有版本
gcloud run revisions list --service=road-safety-frontend --region=asia-east1

# 2. 切換流量到特定版本
gcloud run services update-traffic road-safety-frontend \
  --region=asia-east1 \
  --to-revisions=road-safety-frontend-00001-xxx=100
```

### 刪除服務

```bash
gcloud run services delete road-safety-frontend --region=asia-east1
```

### 監控與日誌

```bash
# 即時監控日誌
gcloud logging tail \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend"

# 查看錯誤日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend AND severity>=ERROR" \
  --limit=50
```

---

## 效能優化建議

### 1. 使用 CDN

設定 Cloud CDN 加速靜態資源：
```bash
gcloud compute backend-services update BACKEND_SERVICE_NAME \
  --enable-cdn
```

### 2. 調整資源配置

根據實際使用情況調整：
```bash
gcloud run services update road-safety-frontend \
  --region=asia-east1 \
  --memory=256Mi \      # 如果足夠，可降低到 256Mi
  --cpu=0.5 \           # 如果足夠，可降低到 0.5
  --min-instances=1 \   # 設定最小實例數避免冷啟動
  --max-instances=20    # 根據流量調整
```

### 3. 預壓縮靜態資源

在建置階段預先壓縮：
```dockerfile
RUN npm run build && gzip -k dist/**/*.{js,css,html,json}
```

然後設定 Nginx：
```nginx
gzip_static on;
```

---

## 安全性建議

### 1. 移除 --allow-unauthenticated（生產環境）

```bash
# 部署時不加 --allow-unauthenticated
gcloud run deploy road-safety-frontend \
  --image=... \
  --no-allow-unauthenticated
```

### 2. 使用 Secret Manager 管理敏感資料

```bash
# 建立 secret
echo -n "你的_MAPBOX_TOKEN" | gcloud secrets create mapbox-token --data-file=-

# 使用 secret
gcloud run services update road-safety-frontend \
  --update-secrets=MAPBOX_TOKEN=mapbox-token:latest
```

### 3. 設定 VPC 連接器（如需內部網路）

```bash
gcloud run services update road-safety-frontend \
  --vpc-connector=VPC_CONNECTOR_NAME
```

### 4. 啟用 Cloud Armor（DDoS 防護）

```bash
gcloud compute security-policies create frontend-security-policy
gcloud compute security-policies rules create 1000 \
  --security-policy=frontend-security-policy \
  --expression="origin.region_code == 'TW'" \
  --action=allow
```

---

## 成本優化

### 當前設定成本估算

基於以下設定：
- Memory: 512Mi
- CPU: 1
- Min instances: 0
- Max instances: 10

**預估月費**（假設每月 10,000 次請求，平均回應時間 100ms）：
- 請求費用：約 $0.40
- 運算費用：約 $5-10
- **總計**：約 $5.40-10.40 USD/月

### 降低成本建議

1. **降低資源配置**（如果效能足夠）：
```bash
--memory=256Mi --cpu=0.5
```

2. **設定最大並發數**：
```bash
--concurrency=80  # 預設值，可根據需求調整
```

3. **使用 min-instances=0**：
   - 優點：無流量時不產生費用
   - 缺點：冷啟動延遲 1-3 秒

---

## 附錄

### A. 完整的一鍵部署腳本

建立檔案：`deploy-frontend.sh`

```bash
#!/bin/bash
set -e

# 顏色輸出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Smart Road Safety System - Frontend Deployment ===${NC}"

# 變數設定
PROJECT_ID="three-birds-on-mountain"
REGION="asia-east1"
SERVICE_NAME="road-safety-frontend"
BACKEND_URL="https://road-safety-backend-303764303193.asia-east1.run.app/api/v1"
MAPBOX_TOKEN="你的_MAPBOX_TOKEN"

# 1. 設定專案
echo -e "${YELLOW}Step 1: Setting up GCP project...${NC}"
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION

# 2. 建置映像
echo -e "${YELLOW}Step 2: Building Docker image...${NC}"
cd frontend
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_VITE_API_BASE_URL="$BACKEND_URL",_VITE_MAPBOX_ACCESS_TOKEN="$MAPBOX_TOKEN"

# 3. 部署服務
echo -e "${YELLOW}Step 3: Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --image=asia-east1-docker.pkg.dev/$PROJECT_ID/containers/frontend:latest \
  --region=$REGION \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated

# 4. 取得服務 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION --format="value(status.url)")

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "Service URL: ${GREEN}$SERVICE_URL${NC}"
echo -e "Health Check: ${GREEN}$SERVICE_URL/health${NC}"
```

使用方式：
```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

### B. 環境變數清單

| 變數 | 類型 | 必要 | 說明 |
|------|------|------|------|
| `VITE_API_BASE_URL` | 建置時 | ✓ | 後端 API URL |
| `VITE_MAPBOX_ACCESS_TOKEN` | 建置時 | ✓ | Mapbox Token |
| `VITE_USE_MOCK_API` | 建置時 | ✓ | Mock API 開關 |
| `VITE_FALLBACK_TO_MOCK` | 建置時 | ✓ | Mock Fallback |
| `VITE_DISABLE_MOCK_PREVIEW` | 建置時 | ✓ | 停用 Mock 預覽 |
| `PORT` | 執行時 | ✓ | Nginx 監聽 Port |

### C. 參考資源

- [Cloud Run 官方文件](https://cloud.google.com/run/docs)
- [Nginx 設定指南](https://nginx.org/en/docs/)
- [Vite 環境變數](https://vitejs.dev/guide/env-and-mode.html)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)

---

**文件版本**：1.0
**作者**：Smart Road Safety System Team
**最後審查日期**：2025-11-08
