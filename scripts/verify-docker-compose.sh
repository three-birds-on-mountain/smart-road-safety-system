#!/bin/bash

set -e

echo "=== Docker Compose 驗證腳本 ==="
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: 檢查配置
echo "Step 1: 檢查 Docker Compose 配置..."
if docker-compose config > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 配置語法正確${NC}"
else
  echo -e "${RED}✗ 配置語法錯誤${NC}"
  exit 1
fi
echo ""

# Step 2: 檢查環境變數
echo "Step 2: 檢查必要的環境變數..."
MISSING_VARS=0

if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
  echo -e "${YELLOW}⚠ GOOGLE_MAPS_API_KEY 未設定（部分功能可能無法使用）${NC}"
  MISSING_VARS=1
fi

if [ -z "$VITE_MAPBOX_ACCESS_TOKEN" ]; then
  echo -e "${YELLOW}⚠ VITE_MAPBOX_ACCESS_TOKEN 未設定（地圖將無法載入）${NC}"
  MISSING_VARS=1
fi

if [ $MISSING_VARS -eq 1 ]; then
  echo -e "${YELLOW}提示: 請在專案根目錄建立 .env 檔案並設定必要的環境變數${NC}"
  echo "參考 docs/environment-variables.md"
  echo ""
  read -p "是否繼續驗證（不完整的功能）？ [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
echo ""

# Step 3: 啟動 PostgreSQL
echo "Step 3: 啟動 PostgreSQL..."
docker-compose up -d postgres
echo "等待 PostgreSQL 啟動（約 10 秒）..."
sleep 10

# 檢查 PostgreSQL 狀態
if docker-compose ps postgres | grep -q "healthy"; then
  echo -e "${GREEN}✓ PostgreSQL 運行正常${NC}"
else
  echo -e "${RED}✗ PostgreSQL 未就緒${NC}"
  echo "PostgreSQL 日誌："
  docker-compose logs postgres | tail -20
  exit 1
fi
echo ""

# 驗證 PostGIS 擴充
echo "Step 4: 驗證 PostGIS 擴充..."
if docker-compose exec -T postgres psql -U postgres -d road_safety_db -c "SELECT PostGIS_Version();" > /dev/null 2>&1; then
  POSTGIS_VERSION=$(docker-compose exec -T postgres psql -U postgres -d road_safety_db -t -c "SELECT PostGIS_Version();" | xargs)
  echo -e "${GREEN}✓ PostGIS 已安裝: $POSTGIS_VERSION${NC}"
else
  echo -e "${RED}✗ PostGIS 擴充未安裝${NC}"
  exit 1
fi
echo ""

# Step 5: 建置並啟動 Backend
echo "Step 5: 建置並啟動 Backend..."
docker-compose up -d --build backend
echo "等待 Backend 啟動（約 15 秒）..."
sleep 15

# 檢查 Backend 日誌
echo "Backend 日誌（最後 10 行）："
docker-compose logs backend | tail -10
echo ""

# Step 6: 測試 Backend API
echo "Step 6: 測試 Backend API..."
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API 運行正常${NC}"
    curl -s http://localhost:8000/health | python3 -m json.tool
    break
  else
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "重試 ($RETRY_COUNT/$MAX_RETRIES)..."
      sleep 3
    else
      echo -e "${RED}✗ Backend API 無法存取${NC}"
      echo "Backend 日誌："
      docker-compose logs backend | tail -30
      exit 1
    fi
  fi
done
echo ""

# Step 7: 啟動 Frontend
echo "Step 7: 啟動 Frontend..."
docker-compose up -d frontend
echo "等待 Frontend 安裝依賴並啟動（約 60 秒）..."
sleep 60

# Step 8: 檢查 Frontend
echo "Step 8: 檢查 Frontend..."
if curl -f http://localhost:5173 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Frontend 運行正常${NC}"
else
  echo -e "${YELLOW}⚠ Frontend 可能尚未完全啟動，請檢查日誌${NC}"
  echo "Frontend 日誌（最後 20 行）："
  docker-compose logs frontend | tail -20
fi
echo ""

# Step 9: 測試容器間網路
echo "Step 9: 測試容器間網路連接..."
if docker-compose exec -T frontend sh -c "wget -q -O- http://backend:8000/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Frontend 可以連接到 Backend${NC}"
else
  echo -e "${RED}✗ Frontend 無法連接到 Backend${NC}"
  exit 1
fi
echo ""

# 完成
echo "=== 驗證完成 ==="
echo ""
echo -e "${GREEN}所有服務已啟動！${NC}"
echo ""
echo "請在瀏覽器開啟以下網址進行手動測試："
echo "  - Frontend:     http://localhost:5173"
echo "  - Backend API:  http://localhost:8000/docs"
echo "  - Health Check: http://localhost:8000/health"
echo ""
echo "查看日誌："
echo "  docker-compose logs -f [service_name]"
echo ""
echo "停止所有服務："
echo "  docker-compose down"
echo ""
echo "清理所有資料（包含資料庫）："
echo "  docker-compose down -v"
