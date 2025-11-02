# 快速開始指南：智慧道路守護系統

**功能**: [spec.md](spec.md) | **計劃**: [plan.md](plan.md) | **日期**: 2025-11-02

## 概述

本指南幫助開發者快速設定本地開發環境，並啟動智慧道路守護系統的後端API與前端介面。

**目標讀者**: 後端與前端開發者
**預估完成時間**: 30-45分鐘

---

## 環境需求

### 必要軟體

| 軟體 | 版本 | 用途 | 安裝說明 |
|------|------|------|----------|
| **Python** | 3.12+ | 後端開發語言 | [python.org](https://www.python.org/downloads/) |
| **uv** | 最新版 | Python套件管理器 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| **Node.js** | 20+ | 前端開發環境 | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | 15+ | 資料庫 | [postgresql.org](https://www.postgresql.org/download/) |
| **PostGIS** | 3.4+ | 地理空間擴充 | 通常隨PostgreSQL一起安裝 |
| **Docker** | 最新版 | 容器化部署 | [docker.com](https://www.docker.com/get-started) |
| **Docker Compose** | 最新版 | 多容器編排 | 隨Docker Desktop安裝 |

### 選用工具

- **pgAdmin 4** 或 **DBeaver**: PostgreSQL資料庫管理工具
- **Postman** 或 **Insomnia**: API測試工具
- **VS Code** + Python/TypeScript擴充套件: 推薦的IDE

---

## 快速啟動（使用 Docker Compose）

### 1. 複製專案

```bash
git clone <repository-url>
cd smart-road-safety-system
git checkout 001-road-safety-system
```

### 2. 設定環境變數

#### 後端環境變數

```bash
cp backend/.env.example backend/.env
```

編輯 `backend/.env`：

```env
# 資料庫設定
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/road_safety
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=road_safety

# Google Maps API（用於A3地理編碼）
GOOGLE_MAPS_API_KEY=your_api_key_here

# API設定
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# 日誌設定
LOG_LEVEL=INFO
```

#### 前端環境變數

```bash
cp frontend/.env.example frontend/.env
```

編輯 `frontend/.env`：

```env
# 後端API
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Mapbox Token
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
```

### 3. 啟動所有服務

```bash
docker-compose up -d
```

這會啟動：
- PostgreSQL資料庫（Port 5432）
- 後端FastAPI服務（Port 8000）
- 前端Vite開發伺服器（Port 5173）

### 4. 執行資料庫遷移

```bash
docker-compose exec backend uv run alembic upgrade head
```

### 5. 驗證服務

- **後端健康檢查**: http://localhost:8000/health
- **API文件（Swagger UI）**: http://localhost:8000/docs
- **前端應用**: http://localhost:5173

---

## 本地開發設定（不使用 Docker）

### 後端設定

#### 1. 安裝 PostgreSQL + PostGIS

**macOS (Homebrew)**:
```bash
brew install postgresql@15 postgis
brew services start postgresql@15
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-15-postgis-3
sudo systemctl start postgresql
```

**Windows**:
- 下載並安裝 [PostgreSQL + PostGIS Bundle](https://postgis.net/windows_downloads/)

#### 2. 建立資料庫

```bash
psql -U postgres
```

```sql
CREATE DATABASE road_safety;
\c road_safety
CREATE EXTENSION postgis;
\q
```

#### 3. 安裝 Python 依賴

```bash
cd backend
uv sync
```

#### 4. 執行資料庫遷移

```bash
uv run alembic upgrade head
```

#### 5. 啟動開發伺服器

```bash
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

後端API現在運行於 http://localhost:8000

### 前端設定

#### 1. 安裝依賴

```bash
cd frontend
npm install
```

#### 2. 啟動開發伺服器

```bash
npm run dev
```

前端應用現在運行於 http://localhost:5173

---

## API 測試範例

### 使用 curl

#### 1. 健康檢查

```bash
curl http://localhost:8000/health
```

**預期回應**:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-02T10:30:00Z",
  "database": "connected"
}
```

#### 2. 查詢附近熱點

```bash
curl -X GET "http://localhost:8000/api/v1/hotspots/nearby?latitude=25.0330&longitude=121.5654&distance=1000&time_range=3_months&severity_levels=A1,A2"
```

**預期回應**:
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "center_latitude": 25.0342,
      "center_longitude": 121.5678,
      "radius_meters": 250,
      "total_accidents": 12,
      "a1_count": 2,
      "a2_count": 7,
      "a3_count": 3,
      "distance_from_user_meters": 450,
      "severity_score": 8.5
    }
  ],
  "meta": {
    "total_count": 1,
    "user_location": {
      "latitude": 25.0330,
      "longitude": 121.5654
    },
    "query_radius_meters": 1000
  }
}
```

#### 3. 查詢地圖範圍內的熱點

```bash
curl -X GET "http://localhost:8000/api/v1/hotspots/in-bounds?sw_lat=24.95&sw_lng=121.45&ne_lat=25.15&ne_lng=121.65&limit=100"
```

### 使用 Python Requests

```python
import requests

# 查詢附近熱點
response = requests.get(
    "http://localhost:8000/api/v1/hotspots/nearby",
    params={
        "latitude": 25.0330,
        "longitude": 121.5654,
        "distance": 1000,
        "time_range": "3_months",
        "severity_levels": "A1,A2"
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"找到 {data['meta']['total_count']} 個熱點")
    for hotspot in data['data']:
        print(f"  - 熱點ID: {hotspot['id']}")
        print(f"    距離: {hotspot['distance_from_user_meters']}公尺")
        print(f"    事故數: {hotspot['total_accidents']} (A1:{hotspot['a1_count']}, A2:{hotspot['a2_count']}, A3:{hotspot['a3_count']})")
else:
    print(f"請求失敗: {response.status_code}")
    print(response.json())
```

---

## 執行測試

### 後端測試

```bash
cd backend

# 執行所有測試
uv run pytest

# 執行特定測試類型
uv run pytest tests/unit/           # 單元測試
uv run pytest tests/integration/    # 整合測試
uv run pytest tests/contract/       # 契約測試

# 產生覆蓋率報告
uv run pytest --cov=src --cov-report=html
open htmlcov/index.html
```

### 前端測試

```bash
cd frontend

# 執行單元測試
npm run test

# 執行整合測試
npm run test:integration

# 產生覆蓋率報告
npm run test:coverage
```

---

## 常見問題排解

### 1. PostgreSQL 連線失敗

**錯誤訊息**: `connection to server at "localhost", port 5432 failed`

**解決方法**:
- 確認PostgreSQL服務已啟動：
  ```bash
  # macOS
  brew services list | grep postgresql

  # Linux
  sudo systemctl status postgresql

  # Docker
  docker-compose ps
  ```
- 檢查連線字串是否正確（`.env` 檔案）

### 2. PostGIS 擴充未安裝

**錯誤訊息**: `ERROR: type "geography" does not exist`

**解決方法**:
```sql
-- 連線到資料庫並啟用PostGIS
psql -U postgres -d road_safety
CREATE EXTENSION IF NOT EXISTS postgis;
\dx  -- 檢查已安裝的擴充
```

### 3. Google Maps API 配額超限

**錯誤訊息**: `OVER_QUERY_LIMIT`

**解決方法**:
- 檢查 [Google Cloud Console](https://console.cloud.google.com/) 的API配額使用情況
- 啟用計費帳戶以提高配額
- 實作請求限速與快取機制

### 4. Mapbox Token 無效

**錯誤訊息**: `401 Unauthorized`（前端地圖無法載入）

**解決方法**:
- 前往 [Mapbox Account](https://account.mapbox.com/) 取得新的Access Token
- 確認Token已設定於 `frontend/.env` 的 `VITE_MAPBOX_ACCESS_TOKEN`
- 重新啟動前端開發伺服器

### 5. CORS 錯誤

**錯誤訊息**: `Access to fetch at ... has been blocked by CORS policy`

**解決方法**:
- 確認 `backend/.env` 的 `CORS_ORIGINS` 包含前端URL
- 範例：`CORS_ORIGINS=http://localhost:5173,http://localhost:3000`

### 6. uv 找不到指令

**錯誤訊息**: `command not found: uv`

**解決方法**:
```bash
# 安裝 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 確認安裝成功
uv --version
```

---

## 資料擷取與熱點分析

### 手動觸發資料擷取（管理端點）

```bash
# 擷取所有來源（A1, A2, A3）
curl -X POST http://localhost:8000/api/v1/admin/ingest \
  -H "Content-Type: application/json" \
  -d '{}'

# 只擷取A2與A3
curl -X POST http://localhost:8000/api/v1/admin/ingest \
  -H "Content-Type: application/json" \
  -d '{"source_types": ["A2", "A3"]}'
```

### 手動觸發熱點分析

```bash
# 使用預設參數（過去一年、epsilon=500m、min_samples=5）
curl -X POST http://localhost:8000/api/v1/admin/analyze-hotspots \
  -H "Content-Type: application/json" \
  -d '{}'

# 自訂參數
curl -X POST http://localhost:8000/api/v1/admin/analyze-hotspots \
  -H "Content-Type: application/json" \
  -d '{
    "analysis_period_days": 180,
    "epsilon_meters": 300,
    "min_samples": 3
  }'
```

### 排程工作（Cron）

在生產環境中，應設定定時任務：

```bash
# 編輯 crontab
crontab -e
```

```cron
# 每月1號凌晨2點執行資料擷取
0 2 1 * * curl -X POST http://localhost:8000/api/v1/admin/ingest

# 每日凌晨3點執行熱點分析
0 3 * * * curl -X POST http://localhost:8000/api/v1/admin/analyze-hotspots
```

---

## 資料庫管理

### 使用 pgAdmin 或 psql 檢視資料

```bash
# 連線到資料庫
psql -U postgres -d road_safety
```

```sql
-- 查看事故記錄數量
SELECT source_type, COUNT(*)
FROM accidents
GROUP BY source_type;

-- 查看最新的熱點分析
SELECT
    analysis_date,
    COUNT(*) as hotspot_count,
    SUM(total_accidents) as total_accidents
FROM hotspots
GROUP BY analysis_date
ORDER BY analysis_date DESC
LIMIT 10;

-- 查詢特定位置附近的事故
SELECT
    id,
    occurred_at,
    severity_level,
    location_text,
    ST_Distance(
        geom,
        ST_SetSRID(ST_MakePoint(121.5654, 25.0330), 4326)::geography
    ) as distance_meters
FROM accidents
WHERE ST_DWithin(
    geom,
    ST_SetSRID(ST_MakePoint(121.5654, 25.0330), 4326)::geography,
    1000
)
ORDER BY distance_meters
LIMIT 10;
```

### 資料庫備份與還原

```bash
# 備份資料庫
pg_dump -U postgres -d road_safety -F c -f road_safety_backup.dump

# 還原資料庫
pg_restore -U postgres -d road_safety -c road_safety_backup.dump
```

---

## 開發工作流程

### 1. 建立新功能分支

```bash
git checkout -b feature/your-feature-name
```

### 2. 開發與測試

- 遵循 TDD 流程：先寫測試，再寫實作
- 執行測試確保覆蓋率 ≥ 80%
- 使用 `uv run black .` 格式化Python程式碼
- 使用 `npm run lint` 檢查TypeScript程式碼

### 3. 提交變更

```bash
git add .
git commit -m "feat: add your feature description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 4. 推送並建立 Pull Request

```bash
git push origin feature/your-feature-name
```

---

## 後續步驟

完成環境設定後，建議：

1. **閱讀規格文件**: [spec.md](spec.md) 了解功能需求
2. **查看資料模型**: [data-model.md](data-model.md) 理解資料結構
3. **研究技術決策**: [research.md](research.md) 了解架構選擇
4. **API 契約定義**: [contracts/openapi.yaml](contracts/openapi.yaml) 查看完整API規格
5. **執行任務**: 使用 `/speckit.tasks` 產生實作任務清單

---

## 支援與資源

### 文件連結

- **功能規格**: [spec.md](spec.md)
- **實作計劃**: [plan.md](plan.md)
- **研究決策**: [research.md](research.md)
- **資料模型**: [data-model.md](data-model.md)
- **API 契約**: [contracts/openapi.yaml](contracts/openapi.yaml)

### 外部資源

- [FastAPI 官方文件](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.x 文件](https://docs.sqlalchemy.org/en/20/)
- [PostGIS 使用手冊](https://postgis.net/documentation/)
- [Mapbox GL JS API](https://docs.mapbox.com/mapbox-gl-js/api/)
- [React 官方文件](https://react.dev/)
- [Vite 官方文件](https://vitejs.dev/)

### 社群

- 專案Issue追蹤：<repository-issues-url>
- 討論區：<repository-discussions-url>

---

**祝開發順利！** 🚀
