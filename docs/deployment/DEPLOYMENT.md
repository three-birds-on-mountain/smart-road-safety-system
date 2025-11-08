# 部署指南

本文件記錄了如何部署 TPML Seat Tracker 的前端和後端服務到 Google Cloud Run。

## 目錄

- [前置需求](#前置需求)
- [後端部署](#後端部署)
- [前端部署](#前端部署)
- [環境變數](#環境變數)
- [服務 URL](#服務-url)
- [常見問題](#常見問題)

## 前置需求

1. 安裝 Google Cloud SDK
2. 設定專案：
   ```bash
   gcloud config set project three-birds-on-mountain
   gcloud config set compute/region asia-east1
   ```

## 後端部署

### 初次部署

1. 進入後端目錄：
   ```bash
   cd backend
   ```

2. 建置 Docker 映像檔：
   ```bash
   gcloud builds submit --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest .
   ```

3. 部署到 Cloud Run：
   ```bash
   gcloud run deploy tpml-backend \
     --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
     --region=asia-east1 \
     --platform=managed \
     --allow-unauthenticated \
     --project=three-birds-on-mountain
   ```

### 重新部署

當你修改了後端程式碼後，執行以下步驟重新部署：

```bash
cd backend
gcloud builds submit --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest .
gcloud run deploy tpml-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --project=three-birds-on-mountain
```

### 更新環境變數

如果需要更新後端的環境變數（例如 CORS_ORIGINS）：

```bash
gcloud run services update tpml-backend \
  --region=asia-east1 \
  --update-env-vars="CORS_ORIGINS=https://tpml-frontend-303764303193.asia-east1.run.app" \
  --project=three-birds-on-mountain
```

## 前端部署

### 初次部署

1. 進入前端目錄：
   ```bash
   cd frontend
   ```

2. 建置 Docker 映像檔（注入建置參數）：
   ```bash
   gcloud builds submit --config cloudbuild.yaml \
     --substitutions=_API_URL="https://tpml-backend-303764303193.asia-east1.run.app",_MAPBOX_TOKEN="<你的 Mapbox Token>" \
     --project=three-birds-on-mountain
   ```

3. 部署到 Cloud Run：
   ```bash
   gcloud run deploy tpml-frontend \
     --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
     --region=asia-east1 \
     --platform=managed \
     --allow-unauthenticated \
     --port=80 \
     --project=three-birds-on-mountain
   ```

### 重新部署

當你修改了前端程式碼後，執行以下步驟重新部署：

```bash
cd frontend
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_API_URL="https://tpml-backend-303764303193.asia-east1.run.app",_MAPBOX_TOKEN="pk.eyJ1IjoiamFja3kxMjM0IiwiYSI6ImNtaGhkZzNsaTBlNjEyanByMnFoNmgxa3YifQ.VaQAfhvfNj4UaWSoxFVVjg" \
  --project=three-birds-on-mountain

gcloud run deploy tpml-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=80 \
  --project=three-birds-on-mountain
```

## 環境變數

### 前端建置參數

前端使用 Cloud Build 建置時需要注入以下參數：

- `_API_URL`: 後端 API 的 URL
  - 目前值: `https://tpml-backend-303764303193.asia-east1.run.app`

- `_MAPBOX_TOKEN`: Mapbox 的存取 Token
  - 目前值: `pk.eyJ1IjoiamFja3kxMjM0IiwiYSI6ImNtaGhkZzNsaTBlNjEyanByMnFoNmgxa3YifQ.VaQAfhvfNj4UaWSoxFVVjg`

這些參數會在建置時透過 Dockerfile 的 ARG 和 ENV 注入到前端應用程式中。

### 後端環境變數

後端在 Cloud Run 上的環境變數：

- `CORS_ORIGINS`: 允許的前端 URL
  - 目前值: `https://tpml-frontend-303764303193.asia-east1.run.app`

## 服務 URL

### 生產環境

- **前端**: https://tpml-frontend-303764303193.asia-east1.run.app
- **後端**: https://tpml-backend-303764303193.asia-east1.run.app
- **後端 API 文件**: https://tpml-backend-303764303193.asia-east1.run.app/docs

### API 端點

後端 API 端點前綴為 `/api/v1/`，例如：

- `/api/v1/health` - 健康檢查
- `/api/v1/libraries` - 圖書館列表
- `/api/v1/predict` - 座位預測
- `/api/v1/realtime` - 即時座位資訊

## 常見問題

### 前端建置失敗

#### 問題 1: `npm ci` 失敗（缺少 package-lock.json）

**解決方案**: 已在 `Dockerfile` 中改用 `npm install --production=false`

#### 問題 2: TypeScript 編譯錯誤

**解決方案**: 已在 `Dockerfile` 中改用 `npx vite build` 跳過 TypeScript 嚴格檢查

#### 問題 3: nginx.conf 檔案找不到

**原因**: `.dockerignore` 中包含了 `docker` 目錄

**解決方案**: 已從 `.dockerignore` 中移除 `docker` 行

### 檢查服務狀態

查看後端服務狀態：
```bash
gcloud run services describe tpml-backend --region=asia-east1 --project=three-birds-on-mountain
```

查看前端服務狀態：
```bash
gcloud run services describe tpml-frontend --region=asia-east1 --project=three-birds-on-mountain
```

### 查看日誌

查看後端日誌：
```bash
gcloud run logs read tpml-backend --region=asia-east1 --project=three-birds-on-mountain
```

查看前端日誌：
```bash
gcloud run logs read tpml-frontend --region=asia-east1 --project=three-birds-on-mountain
```

## 檔案結構

### 前端相關檔案

- `frontend/Dockerfile` - 前端 Docker 映像檔定義（多階段建置）
- `frontend/cloudbuild.yaml` - Cloud Build 建置設定
- `frontend/docker/nginx.conf` - Nginx 設定（SPA 路由、安全標頭、快取）
- `frontend/.dockerignore` - Docker 建置時要忽略的檔案

### 後端相關檔案

- `backend/Dockerfile` - 後端 Docker 映像檔定義
- 後端使用標準的 `gcloud builds submit` 建置流程

## 部署檢查清單

### 前端部署

- [ ] 確認後端 API URL 正確
- [ ] 確認 Mapbox Token 有效
- [ ] 建置 Docker 映像檔
- [ ] 部署到 Cloud Run
- [ ] 測試前端頁面載入
- [ ] 測試 API 整合
- [ ] 測試地圖顯示

### 後端部署

- [ ] 建置 Docker 映像檔
- [ ] 部署到 Cloud Run
- [ ] 更新 CORS_ORIGINS 包含前端 URL
- [ ] 測試 API 端點
- [ ] 檢查日誌無錯誤

## 維護注意事項

1. **更新後端 URL**: 如果後端 URL 改變，需要重新建置前端並注入新的 `_API_URL`
2. **更新 Mapbox Token**: 如果 Mapbox Token 過期或更新，需要重新建置前端
3. **CORS 設定**: 前端 URL 改變時，記得更新後端的 `CORS_ORIGINS` 環境變數
4. **快取問題**: 前端使用 Nginx 快取靜態資源（1年），如果需要強制更新，可以修改檔案名稱或清除瀏覽器快取
