# Implementation Plan: Google Cloud Run 部署

**Branch**: `002-gcloud-deployment` | **Date**: 2025-11-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-gcloud-deployment/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

將智慧道路守護系統的前後端專案部署到 Google Cloud Run，使用現有的 Cloud SQL 資料庫實例。部署流程包含：後端 FastAPI 服務透過 Unix socket 連接 Cloud SQL、前端 React/Vite 應用程式建置時注入環境變數、資料庫 schema migration、以及服務監控和維護機制。部署採用 Docker 容器化，映像儲存於 Artifact Registry，使用 gcloud CLI 進行部署操作。

## Technical Context

**Language/Version**:
- Backend: Python 3.12
- Frontend: TypeScript 5.9, React 19.1

**Primary Dependencies**:
- Backend: FastAPI 0.104+, SQLAlchemy 2.0+, Alembic 1.12+, uvicorn, pydantic-settings
- Frontend: React 19.1, Vite 7.1, Redux Toolkit 2.10, Mapbox GL 3.16
- Infrastructure: Docker, Google Cloud SDK (gcloud CLI)

**Storage**:
- PostgreSQL 15 on Cloud SQL (現有共用實例)
- GeoAlchemy2 for spatial data support
- Cloud Run managed storage for container instances
- Artifact Registry for Docker images

**Testing**:
- Backend: pytest 7.4+, pytest-cov 4.1+
- Frontend: Vitest 4.0, @testing-library/react 16.3
- Coverage requirement: ≥80% for new code per Constitution

**Target Platform**:
- Backend: Google Cloud Run (Linux containers)
- Frontend: Google Cloud Run (nginx on Linux containers)
- Database: Cloud SQL PostgreSQL 15
- Region: asia-east1
- Project: three-birds-on-mountain

**Project Type**: Web application (frontend + backend)

**Performance Goals**:
- 後端 API 回應時間 p95 < 200ms
- 前端頁面載入 < 2s on 3G
- Health endpoint 回應 < 2s (95% time)
- 冷啟動恢復 < 30s
- 資料庫 migration 執行成功率 100%

**Constraints**:
- 必須使用現有 Cloud SQL 實例（不建立新資料庫）
- 使用 Unix socket 連接資料庫（透過 Cloud SQL Proxy sidecar）
- 服務閒置時自動縮減到 0 實例（成本控制）
- 部署時服務中斷 < 10s
- 遵循 docs/deployment/ 既有部署模式

**Scale/Scope**:
- 預期用戶：中小規模（可擴展到數千並發用戶）
- Cloud Run 自動擴展：min 0, max 10 instances
- 資料庫：共用現有 Cloud SQL 實例
- 部署腳本：約 10-15 個部署指令
- 部署文件：完整操作手冊包含故障排除

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality ✅ PASS

- **Readability First**: 部署腳本和設定檔將使用清晰的命名和註解
- **SOLID Principles**: N/A（部署流程為操作性質，非程式碼開發）
- **DRY with Judgment**: 部署指令會整合到腳本中避免重複
- **Type Safety**: 設定檔案使用強型別（環境變數驗證）
- **Error Handling**: 部署腳本包含錯誤檢查和回報機制

**評估**: 通過。部署本身不涉及應用程式碼開發，但部署腳本和設定遵循可讀性原則。

### II. Testing Discipline ✅ PASS

- **TDD Approach**: 部署驗證測試先於部署執行
  - 測試 1: 驗證 Docker 映像建置成功
  - 測試 2: 驗證服務 health endpoint 回應正常
  - 測試 3: 驗證資料庫連線成功
  - 測試 4: 驗證 API endpoints 運作正常
- **Contract Tests**: API endpoints 在部署前已有完整測試覆蓋
- **Integration Tests**: 部署後執行端到端測試驗證系統整合
- **Coverage**: 既有測試覆蓋率 ≥80%（不降低）

**評估**: 通過。雖然部署本身不是 TDD，但包含完整的部署前/部署後驗證測試。

### III. User Experience Consistency ✅ PASS

- **Feedback**: 部署指令提供即時進度回饋
- **Error Messages**: 部署失敗時提供明確的錯誤訊息和解決方案
- **Loading States**: 不適用（非使用者介面）
- **Accessibility**: 不適用（非使用者介面）
- **Responsive Design**: 不適用（非使用者介面）
- **Consistency**: 部署流程遵循 docs/deployment/ 既有模式，保持一致性
- **Progressive Disclosure**: 部署文件從簡單到進階逐步說明

**評估**: 通過。部署操作體驗一致，文件清晰。

### IV. Performance Standards ✅ PASS

- **Response Time**: API p95 < 200ms（已在既有系統驗證）
- **Page Load**: < 2s on 3G（前端已優化）
- **API Latency**: p95 < 200ms（目標已設定）
- **Monitoring**: Cloud Run 內建監控 + Cloud Logging
- **Benchmarks**: 部署前驗證效能測試通過

**評估**: 通過。效能目標明確，監控機制完整。

### V. Documentation Language ✅ PASS

- **部署文件**: 使用繁體中文撰寫
- **部署腳本註解**: 使用繁體中文
- **README 更新**: 使用繁體中文
- **設定檔說明**: 使用繁體中文註解
- **錯誤訊息**: 盡可能使用繁體中文（gcloud CLI 除外）

**評估**: 通過。所有新增文件使用繁體中文。

### Overall Assessment

**Status**: ✅ 全部通過

**Summary**: 此部署功能符合所有 Constitution 原則。雖然部署本身是操作性質而非程式碼開發，但仍遵循品質、測試、使用者體驗、效能和文件語言的要求。部署流程包含完整的驗證機制，確保服務品質。

**Violations**: 無

**可以進入 Phase 0 研究階段。**

## Project Structure

### Documentation (this feature)

```text
specs/002-gcloud-deployment/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── deployment-api.md        # 部署操作 API 規格
│   └── verification-api.md      # 部署驗證 API 規格
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (frontend + backend)
backend/
├── src/
│   ├── api/                 # API endpoints
│   │   ├── health.py        # Health check endpoint
│   │   ├── accidents.py     # Accidents API
│   │   └── hotspots.py      # Hotspots API
│   ├── core/                # Core configurations
│   │   ├── config.py        # Settings (需更新 DATABASE_URL 支援)
│   │   ├── middleware.py    # CORS middleware
│   │   └── logging.py       # Logging setup
│   ├── db/                  # Database layer
│   │   ├── session.py       # Database connection (需更新為支援 Unix socket)
│   │   └── migrations/      # Alembic migrations
│   ├── models/              # SQLAlchemy models
│   ├── services/            # Business logic
│   └── main.py              # FastAPI application entry
├── Dockerfile               # 需更新為 Cloud Run 最佳實踐
├── alembic.ini              # Alembic configuration
├── pyproject.toml           # Python dependencies
└── tests/                   # Backend tests

frontend/
├── src/
│   ├── components/          # React components
│   │   ├── Map/             # Map-related components
│   │   ├── Settings/        # Settings components
│   │   └── Alert/           # Alert components
│   ├── pages/               # Page components
│   ├── services/            # API services
│   │   ├── api.ts           # Backend API client (需設定 API_URL)
│   │   └── geolocation.ts   # Geolocation service
│   ├── store/               # Redux store
│   └── main.tsx             # React entry point
├── Dockerfile               # 需新建 - 參考 TPML 專案
├── cloudbuild.yaml          # 需新建 - Cloud Build 設定
├── docker/
│   └── nginx.conf           # 需新建 - Nginx 設定
├── package.json             # Node dependencies
├── vite.config.ts           # Vite configuration
└── tests/                   # Frontend tests

# 新增部署相關檔案
docs/
└── deployment/
    ├── DEPLOYMENT.md        # 參考現有 TPML 部署文件
    └── cloud-run-deployment-guide.md  # 參考現有詳細指南

scripts/
└── deploy/                  # 新建目錄
    ├── deploy-backend.sh    # 後端部署腳本
    ├── deploy-frontend.sh   # 前端部署腳本
    ├── run-migration.sh     # Migration 執行腳本
    ├── verify-deployment.sh # 部署驗證腳本
    └── README.md            # 腳本使用說明

.github/
└── workflows/               # 可選：CI/CD 自動化
    ├── deploy-backend.yml   # 後端自動部署
    └── deploy-frontend.yml  # 前端自動部署
```

**Structure Decision**:

此專案為 Web 應用程式結構（frontend + backend）。部署功能主要涉及：

1. **Backend 修改**:
   - 更新 `src/core/config.py` 支援 Cloud Run 環境變數
   - 更新 `src/db/session.py` 支援 Unix socket 連線
   - 更新 `Dockerfile` 遵循 Cloud Run 最佳實踐
   - 確保 health endpoint 完整性

2. **Frontend 新增**:
   - 新增 `Dockerfile` 用於前端建置和 nginx 服務
   - 新增 `cloudbuild.yaml` 用於 Cloud Build 建置流程
   - 新增 `docker/nginx.conf` 用於 SPA 路由和安全標頭

3. **部署腳本**:
   - `scripts/deploy/` 目錄包含所有部署自動化腳本
   - 腳本遵循 docs/deployment/ 中的既有模式

4. **文件**:
   - 更新 `docs/deployment/` 加入本專案的部署指南
   - 參考 TPML 專案的部署文件結構

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - 無 Constitution 違規，此章節留空。
