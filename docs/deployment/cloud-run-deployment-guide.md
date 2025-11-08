# TPML Seat Tracker - Cloud Run 部署指南

本文件記錄完整的 Cloud Run + Cloud SQL 部署流程，可作為其他專案的參考範本。

## 📊 部署架構總覽

```
┌─────────────────────────────────────────────────────────────┐
│                     Google Cloud Platform                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Cloud Run                          │  │
│  │  ┌────────────────────────────────────────────┐      │  │
│  │  │  Backend Service (FastAPI)                  │      │  │
│  │  │  - 2 workers                                │      │  │
│  │  │  - Auto-scaling                             │      │  │
│  │  └────────────────────────────────────────────┘      │  │
│  │                      │                                │  │
│  │                      │ Unix Socket                    │  │
│  │                      ▼                                │  │
│  │  ┌────────────────────────────────────────────┐      │  │
│  │  │  Cloud SQL Proxy (Sidecar)                  │      │  │
│  │  └────────────────────────────────────────────┘      │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                      │
│                      │ Secure Connection                    │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Cloud SQL (PostgreSQL 15)                │  │
│  │  - db-f1-micro                                        │  │
│  │  - 10GB SSD                                           │  │
│  │  - Auto-backup                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Secret Manager                           │  │
│  │  - database-password                                  │  │
│  │  - api-tokens                                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## ✅ 完成狀態

### 已部署資源

| 資源類型 | 名稱 | 狀態 | 區域 |
|---------|------|------|------|
| Cloud SQL | `tpml-seat-tracker-db` | ✅ 運行中 | asia-east1 |
| Cloud Run Service | `tpml-backend` | ✅ 運行中 | asia-east1 |
| Artifact Registry | `containers` | ✅ 已建立 | asia-east1 |
| Secret | `database-password` | ✅ 已建立 | automatic |
| Secret | `mapbox-token` | ✅ 已建立 | automatic |

### 部署資訊

**專案**: `three-birds-on-mountain` (303764303193)

**Cloud SQL**:
- 連線名稱: `three-birds-on-mountain:asia-east1:tpml-seat-tracker-db`
- Public IP: `34.80.1.127`
- 資料庫: `tpml_seat_tracker`
- 使用者: `tpml_user`
- 版本: PostgreSQL 15

**Cloud Run**:
- 服務 URL: `https://tpml-backend-303764303193.asia-east1.run.app`
- 最新版本: `tpml-backend-00007-qxp`
- 映像檔: `asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest`

**資料表** (透過 Alembic migrations 建立):
- `library_info` - 圖書館資訊
- `seat_realtime` - 即時座位資料
- `seat_history` - 歷史座位資料
- `prediction_results` - 預測結果
- `model_registry` - 模型註冊
- `alembic_version` - Migration 版本控制

## 📋 完整部署步驟

### Phase 1: GCP 專案初始設定

#### 1.1 設定專案和區域

```bash
# 設定要使用的 GCP 專案
gcloud config set project YOUR_PROJECT_ID

# 設定預設區域
gcloud config set compute/region asia-east1

# 驗證設定
gcloud config list
```

#### 1.2 啟用必要的 GCP API

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  --project=YOUR_PROJECT_ID
```

**各 API 用途**:
- `run.googleapis.com` - Cloud Run 服務
- `sqladmin.googleapis.com` - Cloud SQL 管理
- `secretmanager.googleapis.com` - 密碼管理
- `cloudbuild.googleapis.com` - Docker 映像建置
- `compute.googleapis.com` - 運算資源（Cloud SQL 需要）

#### 1.3 建立 Artifact Registry

```bash
# 建立 Docker 映像儲存庫
gcloud artifacts repositories create containers \
  --repository-format=docker \
  --location=asia-east1 \
  --description="Docker images for Cloud Run services" \
  --project=YOUR_PROJECT_ID

# 驗證建立
gcloud artifacts repositories list --location=asia-east1
```

---

### Phase 2: Cloud SQL 資料庫設定

#### 2.1 建立 Cloud SQL 實例

```bash
gcloud sql instances create YOUR_DB_INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-east1 \
  --availability-type=ZONAL \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --retained-backups-count=7 \
  --maintenance-window-day=SUNDAY \
  --maintenance-window-hour=2 \
  --database-flags=max_connections=100 \
  --project=YOUR_PROJECT_ID
```

**參數說明**:
- `--tier=db-f1-micro`: 最小規格（共享 CPU，614MB RAM）
- `--availability-type=ZONAL`: 單區域（較便宜，適合開發環境）
- `--storage-auto-increase`: 自動擴充儲存空間
- `--backup-start-time=03:00`: 每日凌晨 3 點備份
- `--retained-backups-count=7`: 保留 7 天備份
- `--maintenance-window-day=SUNDAY`: 週日進行維護

**建立時間**: 約 5-10 分鐘

#### 2.2 取得連線資訊

```bash
# 取得 connection name 和 IP
gcloud sql instances describe YOUR_DB_INSTANCE_NAME \
  --format="value(connectionName,ipAddresses[0].ipAddress)" \
  --project=YOUR_PROJECT_ID
```

輸出範例:
```
three-birds-on-mountain:asia-east1:tpml-seat-tracker-db
34.80.1.127
```

#### 2.3 建立資料庫

```bash
gcloud sql databases create YOUR_DB_NAME \
  --instance=YOUR_DB_INSTANCE_NAME \
  --charset=UTF8 \
  --collation=en_US.UTF8 \
  --project=YOUR_PROJECT_ID
```

#### 2.4 建立資料庫使用者

```bash
# 設定密碼（請使用強密碼）
DB_PASSWORD="YOUR_STRONG_PASSWORD"

# 建立使用者
gcloud sql users create YOUR_DB_USER \
  --instance=YOUR_DB_INSTANCE_NAME \
  --password="$DB_PASSWORD" \
  --project=YOUR_PROJECT_ID
```

**密碼建議**:
- 長度至少 16 字元
- 包含大小寫字母、數字、特殊符號
- 可使用: `openssl rand -base64 24` 產生隨機密碼

---

### Phase 3: Secret Manager 設定

#### 3.1 建立資料庫密碼 Secret

```bash
# 方法 1: 從變數建立
echo -n "$DB_PASSWORD" | gcloud secrets create database-password \
  --data-file=- \
  --replication-policy=automatic \
  --project=YOUR_PROJECT_ID

# 方法 2: 從檔案建立
echo -n "$DB_PASSWORD" > /tmp/db_password.txt
gcloud secrets create database-password \
  --data-file=/tmp/db_password.txt \
  --replication-policy=automatic \
  --project=YOUR_PROJECT_ID
rm /tmp/db_password.txt  # 刪除臨時檔案
```

#### 3.2 授權 Cloud Run 存取 Secrets

```bash
# 取得專案編號
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID \
  --format="value(projectNumber)")

# 授權 Compute Engine 預設服務帳號（Cloud Run 使用）
gcloud secrets add-iam-policy-binding database-password \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID

# 驗證權限
gcloud secrets get-iam-policy database-password --project=YOUR_PROJECT_ID
```

#### 3.3 建立其他 Secrets（如需要）

```bash
# 例如：API tokens
echo -n "YOUR_API_TOKEN" | gcloud secrets create api-token \
  --data-file=- \
  --replication-policy=automatic \
  --project=YOUR_PROJECT_ID

# 同樣授權存取
gcloud secrets add-iam-policy-binding api-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID
```

---

### Phase 4: 後端程式碼準備

#### 4.1 資料庫連線設定

**關鍵檔案**: `backend/src/database.py`

```python
"""
資料庫連線管理

支援兩種模式：
1. 本地開發：使用傳統 DATABASE_URL
2. 生產環境（Cloud Run）：使用 Unix socket 或 DATABASE_URL
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from src.config import settings

# 資料庫 Base 類別
Base = declarative_base()

# 全域變數
_engine = None


def get_engine():
    """取得 SQLAlchemy 引擎"""
    global _engine

    if _engine is None:
        # 直接使用 DATABASE_URL（支援 Unix socket 和 TCP 連線）
        _engine = create_async_engine(
            settings.database_url,
            echo=settings.log_level == "DEBUG",
            pool_pre_ping=True,
        )

    return _engine


def get_session_factory():
    """取得 Session factory（延遲初始化）"""
    return sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db():
    """
    FastAPI dependency: 取得資料庫 session

    Usage:
        @app.get("/items")
        async def read_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async_session = get_session_factory()
    async with async_session() as session:
        yield session


async def close_db_connections():
    """關閉資料庫連線（應用程式關閉時呼叫）"""
    global _engine

    if _engine is not None:
        await _engine.dispose()
        _engine = None
```

**關鍵重點**:
- ✅ 使用簡單的 `DATABASE_URL` 設定
- ✅ 支援 Unix socket 連線（透過 `host=/cloudsql/...`）
- ✅ 不使用 Cloud SQL Python Connector（避免 event loop 問題）
- ✅ `pool_pre_ping=True` 確保連線有效性

#### 4.2 設定檔

**檔案**: `backend/src/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """應用程式設定"""

    # 資料庫連線 URL
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/db"

    # API 設定
    api_base_url: str = "http://localhost:8000"
    log_level: str = "INFO"

    # CORS
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
```

#### 4.3 Dockerfile

**檔案**: `backend/Dockerfile`

```dockerfile
# Multi-stage build for backend

# Stage 1: Build dependencies
FROM python:3.12-slim as builder

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv pip install --system . || pip install fastapi uvicorn sqlalchemy alembic apscheduler httpx pydantic-settings loguru python-dotenv asyncpg psycopg2-binary

# Stage 2: Runtime
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY src ./src
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic

# Create directories for logs and models
RUN mkdir -p logs models

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Health check (使用 curl 或 wget，因為 requests 可能未安裝)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Production command (使用 2 workers)
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

**Dockerfile 特點**:
- ✅ Multi-stage build 減少映像大小
- ✅ 使用 `uv` 加速套件安裝
- ✅ 內建 health check
- ✅ 2 workers 提供基本並發處理

---

### Phase 5: 建置 Docker 映像

#### 5.1 使用 Cloud Build 建置

```bash
cd backend

# 建置並推送到 Artifact Registry
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/YOUR_PROJECT_ID/containers/backend:latest \
  . \
  --project=YOUR_PROJECT_ID
```

**建置時間**: 約 2-3 分鐘（首次較久，之後會使用快取）

#### 5.2 驗證映像

```bash
# 列出映像
gcloud artifacts docker images list \
  asia-east1-docker.pkg.dev/YOUR_PROJECT_ID/containers \
  --project=YOUR_PROJECT_ID

# 查看映像詳細資訊
gcloud artifacts docker images describe \
  asia-east1-docker.pkg.dev/YOUR_PROJECT_ID/containers/backend:latest \
  --project=YOUR_PROJECT_ID
```

---

### Phase 6: 部署到 Cloud Run

#### 6.1 部署服務（使用 Unix Socket 連線）

```bash
gcloud run deploy YOUR_SERVICE_NAME \
  --region=asia-east1 \
  --image=asia-east1-docker.pkg.dev/YOUR_PROJECT_ID/containers/backend:latest \
  --add-cloudsql-instances=YOUR_PROJECT_ID:asia-east1:YOUR_DB_INSTANCE_NAME \
  --update-env-vars="DATABASE_URL=postgresql+asyncpg://YOUR_DB_USER:YOUR_DB_PASSWORD@/YOUR_DB_NAME?host=/cloudsql/YOUR_PROJECT_ID:asia-east1:YOUR_DB_INSTANCE_NAME" \
  --update-env-vars="LOG_LEVEL=INFO" \
  --update-env-vars="CORS_ORIGINS=*" \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --project=YOUR_PROJECT_ID
```

**參數說明**:
- `--add-cloudsql-instances`: 啟用 Cloud SQL Proxy sidecar
- `DATABASE_URL` 使用 Unix socket 格式: `?host=/cloudsql/...`
- `--allow-unauthenticated`: 允許公開存取（視需求調整）
- `--memory=512Mi`: 記憶體限制
- `--min-instances=0`: 閒置時縮減到 0（節省成本）
- `--max-instances=10`: 最多 10 個實例

#### 6.2 使用 Secret Manager（更安全的方式）

```bash
gcloud run deploy YOUR_SERVICE_NAME \
  --region=asia-east1 \
  --image=asia-east1-docker.pkg.dev/YOUR_PROJECT_ID/containers/backend:latest \
  --add-cloudsql-instances=YOUR_PROJECT_ID:asia-east1:YOUR_DB_INSTANCE_NAME \
  --update-env-vars="DATABASE_URL=postgresql+asyncpg://YOUR_DB_USER:SECRET_PLACEHOLDER@/YOUR_DB_NAME?host=/cloudsql/YOUR_PROJECT_ID:asia-east1:YOUR_DB_INSTANCE_NAME" \
  --update-secrets="DB_PASSWORD=database-password:latest" \
  --update-env-vars="LOG_LEVEL=INFO" \
  --allow-unauthenticated \
  --project=YOUR_PROJECT_ID
```

然後在程式碼中讀取 `DB_PASSWORD` 環境變數組合成完整的 DATABASE_URL。

#### 6.3 取得服務 URL

```bash
# 取得服務 URL
gcloud run services describe YOUR_SERVICE_NAME \
  --region=asia-east1 \
  --format="value(status.url)" \
  --project=YOUR_PROJECT_ID
```

---

### Phase 7: 執行資料庫 Migration

#### 7.1 安裝 Cloud SQL Proxy（本地開發用）

**macOS (ARM64)**:
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy
mkdir -p ~/bin
mv cloud-sql-proxy ~/bin/
```

**macOS (Intel)**:
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy
mkdir -p ~/bin
mv cloud-sql-proxy ~/bin/
```

**Linux**:
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/
```

**驗證安裝**:
```bash
~/bin/cloud-sql-proxy --version
```

#### 7.2 啟動 Cloud SQL Proxy

```bash
# 啟動 proxy（在背景執行）
~/bin/cloud-sql-proxy --port 5432 YOUR_PROJECT_ID:asia-east1:YOUR_DB_INSTANCE_NAME &

# 或者使用前景執行（可看到連線日誌）
~/bin/cloud-sql-proxy --port 5432 YOUR_PROJECT_ID:asia-east1:YOUR_DB_INSTANCE_NAME
```

**連線資訊**:
- Host: `127.0.0.1` 或 `localhost`
- Port: `5432`
- Database: YOUR_DB_NAME
- User: YOUR_DB_USER
- Password: YOUR_DB_PASSWORD

#### 7.3 執行 Alembic Migrations

```bash
cd backend

# 設定 DATABASE_URL（使用 psycopg2 for Alembic）
export DATABASE_URL="postgresql+psycopg2://YOUR_DB_USER:YOUR_DB_PASSWORD@127.0.0.1:5432/YOUR_DB_NAME"

# 執行 migrations
uv run alembic upgrade head

# 或使用一般 Python 環境
alembic upgrade head
```

**驗證 migrations**:
```bash
# 查看目前版本
uv run alembic current

# 查看歷史
uv run alembic history
```

#### 7.4 驗證資料表建立

使用任何 PostgreSQL 客戶端工具連線驗證：

**使用 psql**:
```bash
PGPASSWORD="YOUR_DB_PASSWORD" psql \
  -h 127.0.0.1 \
  -p 5432 \
  -U YOUR_DB_USER \
  -d YOUR_DB_NAME \
  -c "\dt"
```

**使用 Python**:
```bash
uv run python3 << 'EOF'
import asyncio
import asyncpg

async def check_tables():
    conn = await asyncpg.connect(
        host='127.0.0.1',
        port=5432,
        user='YOUR_DB_USER',
        password='YOUR_DB_PASSWORD',
        database='YOUR_DB_NAME'
    )

    tables = await conn.fetch("""
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
    """)

    print("📊 資料庫中的表格：")
    for table in tables:
        print(f"  ✅ {table['tablename']}")

    await conn.close()

asyncio.run(check_tables())
EOF
```

---

### Phase 8: 驗證部署

#### 8.1 測試 Health Endpoint

```bash
SERVICE_URL=$(gcloud run services describe YOUR_SERVICE_NAME \
  --region=asia-east1 \
  --format="value(status.url)" \
  --project=YOUR_PROJECT_ID)

# 測試 health endpoint
curl -s "$SERVICE_URL/api/v1/health" | jq
```

**預期輸出**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T12:00:00.000000",
  "database": "connected",
  "scheduler": "stopped"
}
```

**狀態說明**:
- `database: "connected"` - ✅ 資料庫連線正常
- `scheduler: "stopped"` - ⚠️ 排程服務未啟動（正常，除非有設定）
- `status: "degraded"` - 如果 scheduler 停止會顯示 degraded，但不影響 API 功能

#### 8.2 測試 API Endpoints

```bash
# 測試列表 API
curl -s "$SERVICE_URL/api/v1/libraries" | jq

# 測試帶參數的 API
curl -s "$SERVICE_URL/api/v1/libraries?branch_name=總館&user_lat=25.033&user_lng=121.5654&sort_by=distance" | jq
```

**預期輸出**:
```json
{
  "data": [],
  "meta": {
    "timestamp": "2025-11-07T12:00:00.000000",
    "version": "v1",
    "total_count": 0
  }
}
```

如果 `data` 是空的，表示資料庫中還沒有資料，但 API 和資料庫連線都正常。

#### 8.3 檢查 Cloud Run 日誌

```bash
# 查看最近的日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=YOUR_SERVICE_NAME" \
  --limit 50 \
  --format json \
  --project=YOUR_PROJECT_ID | jq -r '.[] | .textPayload // .jsonPayload.message'

# 只看錯誤日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=YOUR_SERVICE_NAME AND severity>=ERROR" \
  --limit 20 \
  --project=YOUR_PROJECT_ID
```

#### 8.4 監控指標

```bash
# 查看服務狀態
gcloud run services describe YOUR_SERVICE_NAME \
  --region=asia-east1 \
  --project=YOUR_PROJECT_ID

# 查看最近的流量
gcloud run services list \
  --region=asia-east1 \
  --project=YOUR_PROJECT_ID
```

---

## 🔑 重要設定重點

### 1. 資料庫連線方式

#### ✅ 推薦：Unix Domain Socket

**優點**:
- 不需要設定 Public IP 或防火牆規則
- 自動 TLS 加密
- 更安全（不經過網路）
- 不會有 timeout 問題
- 設定簡單

**DATABASE_URL 格式**:
```
postgresql+asyncpg://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE
```

**Cloud Run 部署參數**:
```bash
--add-cloudsql-instances=PROJECT:REGION:INSTANCE
```

#### ❌ 不推薦：Cloud SQL Python Connector

**問題**:
- uvicorn 多 workers 環境下會遇到 event loop 問題
- 需要複雜的初始化邏輯
- 除錯困難

#### ❌ 不推薦：直接連 Public IP

**問題**:
- 需要設定防火牆規則
- 可能遇到 timeout
- 需要管理 IP 白名單
- 安全性較低

### 2. 程式碼最佳實踐

#### 簡單的資料庫連線設定

```python
# ✅ 推薦：簡單直接
def get_engine():
    return create_async_engine(
        settings.database_url,
        echo=settings.log_level == "DEBUG",
        pool_pre_ping=True,
    )

# ❌ 避免：過度複雜
# 不要使用 Cloud SQL Connector 的 async_creator
```

#### FastAPI 依賴注入

```python
async def get_db():
    async_session = get_session_factory()
    async with async_session() as session:
        yield session

# 在路由中使用
@app.get("/items")
async def read_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item))
    return result.scalars().all()
```

### 3. 安全性建議

#### Secret Manager 使用

```bash
# ✅ 推薦：使用 Secret Manager
--update-secrets="DB_PASSWORD=database-password:latest"

# ❌ 避免：直接在環境變數中放密碼（除非測試環境）
--update-env-vars="DATABASE_URL=postgresql://user:plaintext_password@..."
```

#### CORS 設定

```python
# 開發環境
cors_origins = "*"

# 生產環境
cors_origins = "https://your-frontend-domain.com,https://www.your-frontend-domain.com"
```

#### 服務存取控制

```bash
# 公開存取（適合公開 API）
--allow-unauthenticated

# 需要驗證（適合內部 API）
--no-allow-unauthenticated
```

### 4. 成本優化

#### Cloud Run 設定

```bash
# 開發環境（節省成本）
--min-instances=0        # 閒置時縮減到 0
--max-instances=5        # 限制最大實例數
--memory=512Mi          # 較小記憶體
--cpu=1                 # 1 vCPU

# 生產環境（保證效能）
--min-instances=1        # 至少保持 1 個實例（減少冷啟動）
--max-instances=100      # 允許更多實例
--memory=1Gi            # 更多記憶體
--cpu=2                 # 2 vCPU
```

#### Cloud SQL 設定

```bash
# 開發環境
--tier=db-f1-micro              # 最小規格
--availability-type=ZONAL       # 單區域

# 生產環境
--tier=db-n1-standard-1         # 標準規格
--availability-type=REGIONAL    # 高可用性（多區域）
```

---

## 🛠️ 常見問題排解

### 問題 1: 資料庫連線失敗

**錯誤訊息**: `ConnectionRefusedError` 或 `TimeoutError`

**原因**:
- 未使用 `--add-cloudsql-instances` 參數
- DATABASE_URL 格式錯誤
- Cloud SQL 實例未啟動

**解決方法**:
```bash
# 1. 確認使用 Unix socket
--add-cloudsql-instances=PROJECT:REGION:INSTANCE

# 2. 確認 DATABASE_URL 格式
DATABASE_URL=postgresql+asyncpg://USER:PASS@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE

# 3. 檢查 Cloud SQL 狀態
gcloud sql instances describe INSTANCE_NAME
```

### 問題 2: Migration 失敗

**錯誤訊息**: `KeyError: 'url'` 或連線錯誤

**原因**:
- Alembic 需要同步驅動（psycopg2）
- DATABASE_URL 未設定或格式錯誤

**解決方法**:
```bash
# Alembic 使用 psycopg2（同步）
export DATABASE_URL="postgresql+psycopg2://USER:PASS@127.0.0.1:5432/DB"

# 透過 Cloud SQL Proxy 連線
~/bin/cloud-sql-proxy --port 5432 PROJECT:REGION:INSTANCE

# 執行 migration
uv run alembic upgrade head
```

### 問題 3: Cloud Build 失敗

**錯誤訊息**: Repository not found

**原因**: Artifact Registry 未建立

**解決方法**:
```bash
gcloud artifacts repositories create containers \
  --repository-format=docker \
  --location=asia-east1 \
  --project=YOUR_PROJECT_ID
```

### 問題 4: 權限錯誤

**錯誤訊息**: Permission denied 或 403 Forbidden

**原因**: Service Account 沒有足夠權限

**解決方法**:
```bash
# 取得專案編號
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# 授權 Cloud SQL 連線
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# 授權 Secret 存取
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 問題 5: 冷啟動時間過長

**現象**: 第一次請求很慢（5-10 秒）

**原因**: Cloud Run 冷啟動 + 資料庫連線建立

**解決方法**:
```bash
# 1. 設定最小實例數（但會增加成本）
--min-instances=1

# 2. 優化 Dockerfile（減少映像大小）
# 3. 使用連線池預熱
# 4. 實作 startup probe
```

---

## 📚 本地開發設定

### 1. 使用 Cloud SQL Proxy

```bash
# 啟動 proxy
~/bin/cloud-sql-proxy --port 5432 PROJECT:REGION:INSTANCE

# 設定環境變數
export DATABASE_URL="postgresql+asyncpg://USER:PASS@127.0.0.1:5432/DB"

# 啟動開發服務器
cd backend
uv run uvicorn src.main:app --reload --port 8000
```

### 2. 使用資料庫工具連線

**DBeaver / TablePlus / DataGrip**:
- Host: `127.0.0.1`
- Port: `5432`
- Database: YOUR_DB_NAME
- Username: YOUR_DB_USER
- Password: YOUR_DB_PASSWORD

**psql**:
```bash
PGPASSWORD="YOUR_DB_PASSWORD" psql \
  -h 127.0.0.1 \
  -p 5432 \
  -U YOUR_DB_USER \
  -d YOUR_DB_NAME
```

### 3. 環境變數管理

**`.env` 檔案** (不要提交到 Git):
```env
DATABASE_URL=postgresql+asyncpg://user:password@127.0.0.1:5432/db
LOG_LEVEL=DEBUG
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

**`.env.example`** (可以提交到 Git):
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/db
LOG_LEVEL=INFO
CORS_ORIGINS=*
```

---

## 🔄 持續部署 (CI/CD)

### GitHub Actions 範例

**`.github/workflows/deploy.yml`**:
```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

env:
  PROJECT_ID: YOUR_PROJECT_ID
  REGION: asia-east1
  SERVICE_NAME: YOUR_SERVICE_NAME

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Build and Push
        run: |
          cd backend
          gcloud builds submit \
            --tag $REGION-docker.pkg.dev/$PROJECT_ID/containers/backend:${{ github.sha }} \
            --tag $REGION-docker.pkg.dev/$PROJECT_ID/containers/backend:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $SERVICE_NAME \
            --region=$REGION \
            --image=$REGION-docker.pkg.dev/$PROJECT_ID/containers/backend:${{ github.sha }} \
            --add-cloudsql-instances=$PROJECT_ID:$REGION:$DB_INSTANCE
```

---

## 📊 監控與告警

### Cloud Monitoring 設定

```bash
# 建立告警政策（CPU 使用率）
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Run High CPU" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s
```

### 日誌查詢範例

```bash
# 查看錯誤日誌
gcloud logging read \
  "resource.type=cloud_run_revision
   AND resource.labels.service_name=YOUR_SERVICE_NAME
   AND severity>=ERROR" \
  --limit 100 \
  --format json

# 查看慢查詢
gcloud logging read \
  "resource.type=cloud_run_revision
   AND resource.labels.service_name=YOUR_SERVICE_NAME
   AND textPayload=~'took.*ms'
   AND textPayload=~'[5-9][0-9]{2,}ms|[0-9]{4,}ms'" \
  --limit 50
```

---

## ✅ 檢查清單

部署前確認：

- [ ] GCP 專案已建立並設定
- [ ] 必要的 API 已啟用
- [ ] Artifact Registry 已建立
- [ ] Cloud SQL 實例已建立並運行
- [ ] 資料庫和使用者已建立
- [ ] Secret Manager 已設定
- [ ] 程式碼中的資料庫連線設定正確
- [ ] Dockerfile 已準備好
- [ ] 環境變數已設定

部署後驗證：

- [ ] Health endpoint 返回 `database: "connected"`
- [ ] API endpoints 正常回應
- [ ] 資料表已建立（透過 migrations）
- [ ] Cloud Run 日誌無錯誤
- [ ] 可以透過 Cloud SQL Proxy 本地連線
- [ ] 資料庫備份已設定

---

## 📖 參考資源

**官方文件**:
- [Cloud Run 文件](https://cloud.google.com/run/docs)
- [Cloud SQL 文件](https://cloud.google.com/sql/docs)
- [Cloud SQL Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)

**最佳實踐**:
- [Cloud Run 最佳實踐](https://cloud.google.com/run/docs/tips)
- [Cloud SQL 連線最佳實踐](https://cloud.google.com/sql/docs/postgres/connect-run)

---

## 📝 更新記錄

| 日期 | 版本 | 說明 |
|------|------|------|
| 2025-11-07 | 1.0.0 | 初始版本 - TPML Seat Tracker 部署記錄 |

---

**作者**: Claude Code
**專案**: TPML Seat Tracker
**部署時間**: 2025-11-07
