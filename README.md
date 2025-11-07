# Smart Road Safety System

智慧道路守護系統是一套結合 FastAPI、React 以及 Mapbox 的全端專案，透過交通事故資料與 GPS 定位在地圖上提供即時危險區域警示。此專案採用前後端分離架構，並提供 docker-compose 進行本地整合環境。

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

```
docker-compose up --build
```

這會啟動：

- `postgres`（PostGIS）
- `backend`（FastAPI）
- `frontend`（Vite dev server）

## Documentation

- `specs/001-road-safety-system/spec.md`：完整需求、User Story、成功指標
- `specs/001-road-safety-system/contracts/openapi.yaml`：API 契約
- `specs/001-road-safety-system/quickstart.md`：端對端操作步驟
- `docs/environment-variables.md`：所有環境變數說明
- `docs/deployment-checklist.md`：部署前檢查清單

## Testing & Coverage

- Backend：`pytest --cov=src --cov-report=term --cov-report=html`
- Frontend：`npm run test -- --run`、`npm run test:coverage`
- E2E（Playwright）：`cd tests/e2e && npm install && npm run test`

## Contributing

1. 根據 `specs/001-road-safety-system/tasks.md` 的任務清單開發
2. 以 TDD 驗證（先寫測試再實作）
3. 所有 commit 採用 Conventional Commits
4. PR 需附上測試結果、覆蓋率摘要與手動驗證說明

## License

專案為內部研發用途，未授權對外公開。請遵循公司安全與資料處理規範。***
