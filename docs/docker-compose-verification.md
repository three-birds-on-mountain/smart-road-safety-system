# Docker Compose 驗證指南

本文件說明如何驗證 Docker Compose 配置是否正確。

## 前置準備

### 1. 確認必要的環境變數

建立 `.env` 檔案在專案根目錄：

```bash
# .env
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
ADMIN_JWT_SECRET=change-me-in-production
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
```

**注意**: 如果沒有真實的 API keys，可以使用 mock 值進行基本測試，但部分功能會失敗。

### 2. 確認 Docker 已安裝並運行

```bash
docker --version
docker-compose --version
```

## 驗證步驟

### Step 1: 驗證 Docker Compose 配置語法

```bash
docker-compose config
```

預期結果：應該輸出完整的配置內容，無錯誤訊息。

### Step 2: 啟動服務（僅 PostgreSQL）

先測試資料庫是否能正常啟動：

```bash
docker-compose up -d postgres
```

檢查狀態：
```bash
docker-compose ps
```

預期結果：postgres 服務狀態為 `Up` 且 healthy。

驗證資料庫連線：
```bash
docker-compose exec postgres psql -U postgres -d road_safety_db -c "SELECT PostGIS_Version();"
```

預期結果：應該顯示 PostGIS 版本資訊。

### Step 3: 建置並啟動後端

```bash
docker-compose up -d --build backend
```

等待約 10-20 秒讓後端啟動，然後檢查日誌：
```bash
docker-compose logs backend
```

預期結果：
- 應該看到 "Application startup complete"
- 無 critical/error 級別的錯誤
- 如果有資料庫遷移相關的日誌，應該顯示成功

測試後端 API：
```bash
curl http://localhost:8000/health
```

預期結果：
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-11-07T..."
}
```

測試 API 文件：
```bash
# 在瀏覽器開啟
open http://localhost:8000/docs
```

預期結果：應該看到 Swagger UI 介面。

### Step 4: 啟動前端

```bash
docker-compose up -d frontend
```

等待約 30-60 秒讓 npm install 完成，然後檢查日誌：
```bash
docker-compose logs frontend
```

預期結果：
- 應該看到 "VITE v..." 和 "Local: http://..."
- 無 fatal errors

測試前端：
```bash
# 在瀏覽器開啟
open http://localhost:5173
```

預期結果：應該看到應用程式介面。

### Step 5: 測試前後端整合

在瀏覽器開發者工具的 Network tab 中，檢查前端是否成功呼叫後端 API：

1. 開啟 http://localhost:5173
2. 打開瀏覽器開發者工具（F12）
3. 切換到 Network tab
4. 觀察是否有對 `http://localhost:8000/api/v1/...` 的請求
5. 檢查請求是否成功（狀態碼 200 或 422）

預期結果：
- 應該看到對 `/api/v1/hotspots/nearby` 或 `/api/v1/hotspots/in-bounds` 的請求
- 如果有真實的 API keys 和資料，應該回傳熱點資料
- 如果使用 mock keys，可能會看到錯誤，但前後端通訊應該正常

### Step 6: 檢查容器間網路連接

進入 frontend 容器，測試是否能連接到 backend：

```bash
docker-compose exec frontend sh
# 在容器內執行
wget -O- http://backend:8000/health
exit
```

預期結果：應該顯示 health check 的 JSON 回應。

## 常見問題排查

### 問題 1: PostgreSQL 無法啟動

**症狀**: postgres 容器一直重啟
**解決方案**:
```bash
# 清除舊資料
docker-compose down -v
docker-compose up -d postgres
```

### 問題 2: Backend 無法連接資料庫

**症狀**: 後端日誌顯示 "could not connect to server"
**解決方案**:
- 確認 postgres 容器已啟動且 healthy
- 檢查 `DATABASE_URL` 環境變數是否正確
- 等待 postgres 完全啟動後再啟動 backend

### 問題 3: Frontend 無法呼叫 API

**症狀**: 瀏覽器 console 顯示 CORS 或 network 錯誤
**解決方案**:
- 確認 `VITE_API_BASE_URL` 設定正確（應該是 `http://localhost:8000/api/v1`）
- 檢查後端 CORS 設定
- 確認後端容器正在運行

### 問題 4: Frontend npm install 失敗

**症狀**: frontend 容器無法啟動，日誌顯示 npm 錯誤
**解決方案**:
```bash
# 清除 node_modules volume
docker-compose down
docker volume rm smart-road-safety-system_node_modules 2>/dev/null || true
docker-compose up -d frontend
```

### 問題 5: 容器間無法通訊

**症狀**: frontend 無法連接到 backend:8000
**解決方案**:
- 確認所有容器在同一個 docker network
- 檢查 docker-compose.yml 的 depends_on 設定
```bash
docker network inspect smart-road-safety-system_default
```

## 完整測試腳本

```bash
#!/bin/bash

echo "=== Docker Compose 驗證腳本 ==="

# Step 1: 檢查配置
echo "Step 1: 檢查配置..."
docker-compose config > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ 配置語法正確"
else
  echo "✗ 配置語法錯誤"
  exit 1
fi

# Step 2: 啟動 PostgreSQL
echo "Step 2: 啟動 PostgreSQL..."
docker-compose up -d postgres
sleep 10

# Step 3: 檢查 PostgreSQL health
echo "Step 3: 檢查 PostgreSQL 狀態..."
docker-compose ps postgres | grep -q "healthy"
if [ $? -eq 0 ]; then
  echo "✓ PostgreSQL 運行正常"
else
  echo "✗ PostgreSQL 未就緒"
  docker-compose logs postgres
  exit 1
fi

# Step 4: 啟動 Backend
echo "Step 4: 啟動 Backend..."
docker-compose up -d --build backend
sleep 15

# Step 5: 測試 Backend API
echo "Step 5: 測試 Backend API..."
curl -f http://localhost:8000/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Backend API 運行正常"
else
  echo "✗ Backend API 無法存取"
  docker-compose logs backend
  exit 1
fi

# Step 6: 啟動 Frontend
echo "Step 6: 啟動 Frontend..."
docker-compose up -d frontend
echo "等待 Frontend 安裝依賴（約 60 秒）..."
sleep 60

# Step 7: 檢查 Frontend
echo "Step 7: 檢查 Frontend..."
curl -f http://localhost:5173 > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Frontend 運行正常"
else
  echo "⚠ Frontend 可能尚未完全啟動，請檢查日誌"
  docker-compose logs frontend | tail -20
fi

echo ""
echo "=== 驗證完成 ==="
echo "請在瀏覽器開啟以下網址進行手動測試："
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000/docs"
echo "  - Health Check: http://localhost:8000/health"
echo ""
echo "如需停止所有服務："
echo "  docker-compose down"
```

將上述腳本儲存為 `scripts/verify-docker-compose.sh`，然後執行：

```bash
chmod +x scripts/verify-docker-compose.sh
./scripts/verify-docker-compose.sh
```

## 清理

完成測試後，清理所有容器和 volumes：

```bash
# 停止並移除容器
docker-compose down

# 移除 volumes（會刪除資料庫資料）
docker-compose down -v

# 移除未使用的映像
docker image prune -f
```

## 生產環境注意事項

在生產環境部署時，需要注意：

1. **不要使用** `-v` flag 清除 volumes（會刪除資料）
2. **務必設定**真實的 `ADMIN_JWT_SECRET`（至少 32 字元）
3. **限制** CORS 允許的來源（不要使用 `*`）
4. **使用** 反向代理（Nginx/Traefik）處理 SSL/TLS
5. **設定** 適當的資源限制（CPU/Memory）
6. **啟用** 日誌收集和監控
7. **規劃** 資料庫備份策略
