# 智慧道路守護系統 | Smart Road Safety System

> 結合政府公開交通事故資料與地理聚類分析，提供即時危險區域警示的 Web 應用

智慧道路守護系統是一套結合 FastAPI、React 以及 Mapbox 的全端專案，透過交通事故資料（A1/A2/A3）與 GPS 定位在地圖上提供即時危險區域警示。系統支援客製化警示設定（距離、事故等級、時間範圍、警示方式）並透過地圖視覺化呈現事故熱點分布。

## 核心功能

- **即時危險區域警示**（US1 - P1 MVP）：駕駛接近事故熱點時，根據用戶設定觸發音效/震動/視覺提示
- **客製化警示設定**（US2 - P2）：調整提醒距離（100m/500m/1km/3km）、事故等級（A1/A2/A3）、時間範圍、警示方式
- **地圖視覺化熱點資訊**（US3 - P3）：地圖上顯示熱點標記、點擊查看詳細資訊（事故數量、等級比例、地址）
- **資料擷取與熱點分析**：每日/每月自動擷取政府公開資料，執行 DBSCAN 聚類分析識別事故熱點
- **Flutter WebView 整合**：透過 JS Bridge 與 TownPass App 整合，支援定位與通知功能

## Project Structure

```
backend/   # FastAPI + SQLAlchemy + Alembic + uv
frontend/  # React + Vite + Redux Toolkit + Mapbox GL JS
docs/      # Cron、環境變數、部署文件
specs/     # 詳細規格、OpenAPI、Quickstart、任務追蹤
tests/     # 後端整合與 E2E 測試腳手架
```

## Prerequisites

- Python 3.12（建議使用 [uv](https://github.com/astral-sh/uv) 管理虛擬環境）
- Node.js 20+ / npm 10+
- Docker & docker-compose（整合測試 / 本地多服務啟動）
- Mapbox Access Token、Google Maps API Key、PostgreSQL + PostGIS（可透過 docker-compose 提供）

## Backend Setup

```bash
cd backend
uv venv --python 3.12
source .venv/bin/activate
uv pip install -e .[dev]

cp .env.example .env  # 設定 DATABASE_URL、GOOGLE_MAPS_API_KEY、ADMIN_JWT_SECRET
alembic upgrade head  # 建立資料表
uvicorn src.main:app --reload
```

常用指令：

```bash
pytest                # 單元與整合測試
pytest --cov=src      # 覆蓋率
ruff check .          # 靜態分析
```

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env  # 設定 VITE_API_BASE_URL、VITE_MAPBOX_ACCESS_TOKEN
npm run dev           # http://localhost:5173
```

其他腳本：

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
npm run build:analyze  # ANALYZE=true npm run build
```

## Docker Compose (Full Stack)

最快速的啟動方式：

```bash
# 啟動所有服務
docker-compose up --build

# 建立測試資料庫（用於測試）
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE road_safety_db_test;"
docker-compose exec postgres psql -U postgres -d road_safety_db_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 執行後端測試
cd backend && TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/road_safety_db_test" uv run pytest tests/ --cov=src
```

這會啟動：

- `postgres`（PostGIS） - Port 5433
- `backend`（FastAPI） - Port 8001
- `frontend`（Vite dev server） - Port 5174

訪問：
- 前端應用：http://localhost:5174
- 後端 API 文件：http://localhost:8001/docs
- 健康檢查：http://localhost:8001/health

## Documentation

- `specs/001-road-safety-system/spec.md`：完整需求、User Story、成功指標
- `specs/001-road-safety-system/contracts/openapi.yaml`：API 契約
- `specs/001-road-safety-system/quickstart.md`：端對端操作步驟
- `docs/environment-variables.md`：所有環境變數說明
- `docs/deployment-checklist.md`：部署前檢查清單

## Testing & Coverage

### 後端測試

```bash
cd backend

# 執行所有測試
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/road_safety_db_test" uv run pytest tests/

# 測試覆蓋率（目前：62%，目標：80%）
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/road_safety_db_test" uv run pytest tests/ --cov=src --cov-report=term --cov-report=html

# 執行特定測試
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/road_safety_db_test" uv run pytest tests/contract/  # API 契約測試
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/road_safety_db_test" uv run pytest tests/integration/  # 整合測試
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/road_safety_db_test" uv run pytest tests/unit/  # 單元測試
```

### 前端測試

```bash
cd frontend

# 單元測試（待實作）
npm run test

# 測試覆蓋率
npm run test:coverage
```

### E2E 測試（可選）

```bash
cd tests/e2e
npm install
npm run test
```

## Contributing

1. 根據 `specs/001-road-safety-system/tasks.md` 的任務清單開發
2. 以 TDD 驗證（先寫測試再實作）
3. 所有 commit 採用 Conventional Commits
4. PR 需附上測試結果、覆蓋率摘要與手動驗證說明

## License

專案為內部研發用途，未授權對外公開。請遵循公司安全與資料處理規範。***
