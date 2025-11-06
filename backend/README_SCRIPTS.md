# 執行 Migration 和 Seed 資料指南

## 在 Docker Compose 環境中執行

### 執行 Alembic Migration

**方法 1: 使用 docker-compose exec（推薦，如果 backend 容器正在運行）**

```bash
# 在專案根目錄執行
docker-compose exec backend alembic upgrade head
```

**方法 2: 使用 docker-compose run（建立臨時容器執行）**

```bash
# 在專案根目錄執行
docker-compose run --rm backend alembic upgrade head
```

**方法 3: 使用 Python 模組**

```bash
docker-compose exec backend python -m alembic upgrade head
# 或
docker-compose run --rm backend python -m alembic upgrade head
```

### 執行 Seed 資料

```bash
# 基本用法
docker-compose exec backend python -m src.scripts.seed_data

# 清除現有資料並重新產生
docker-compose exec backend python -m src.scripts.seed_data --clear

# 自訂數量
docker-compose exec backend python -m src.scripts.seed_data --accidents=200 --hotspots=30
```

**如果 backend 容器沒有運行，使用 `docker-compose run`：**

```bash
docker-compose run --rm backend python -m src.scripts.seed_data --clear
```

### 完整流程範例（Docker Compose）

```bash
# 1. 啟動所有服務（包括資料庫）
docker-compose up -d

# 2. 等待資料庫啟動完成
docker-compose ps postgres

# 3. 執行 Migration
docker-compose exec backend alembic upgrade head

# 4. 執行 Seed 資料
docker-compose exec backend python -m src.scripts.seed_data --clear --accidents=100 --hotspots=20
```

## 前置準備（本地執行）

### 1. 啟動資料庫

如果使用 Docker Compose：

```bash
# 在專案根目錄執行
cd ..
docker-compose up -d postgres

# 等待資料庫啟動完成（約 10-30 秒）
docker-compose ps postgres
```

如果使用本地 PostgreSQL：

```bash
# 確保 PostgreSQL 服務正在運行
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

### 2. 檢查資料庫連接

預設連接字串：`postgresql://postgres:postgres@localhost:5432/road_safety_db`

如果需要修改，可以：

- 建立 `.env` 檔案在 `backend` 目錄下
- 設定 `DATABASE_URL` 環境變數

## 執行 Migration

### 方法 1: 使用腳本（推薦）

```bash
cd backend
./run_migration.sh
```

### 方法 2: 直接執行

```bash
cd backend
uv run alembic upgrade head
```

### 方法 3: 使用 Python 模組

```bash
cd backend
uv run python -m alembic upgrade head
```

## 執行 Seed 資料

### 方法 1: 使用腳本（推薦）

```bash
cd backend
# 基本用法（產生 100 筆事故記錄，20 筆熱點記錄）
./run_seed.sh

# 清除現有資料並重新產生
./run_seed.sh --clear

# 自訂數量
./run_seed.sh --accidents=200 --hotspots=30

# 組合使用
./run_seed.sh --clear --accidents=200 --hotspots=30
```

### 方法 2: 直接執行

```bash
cd backend
# 基本用法
uv run python -m src.scripts.seed_data

# 清除現有資料
uv run python -m src.scripts.seed_data --clear

# 自訂數量
uv run python -m src.scripts.seed_data --accidents=200 --hotspots=30
```

## 完整流程範例

```bash
# 1. 啟動資料庫
cd /Users/claireliang/Desktop/mytest/three-birds-on-mountain/smart-road-safety-system
docker-compose up -d postgres

# 2. 等待資料庫啟動（約 10-30 秒）
sleep 15

# 3. 執行 Migration
cd backend
uv run alembic upgrade head

# 4. 執行 Seed 資料
uv run python -m src.scripts.seed_data --clear --accidents=100 --hotspots=20
```

## 常見問題

### 問題 1: 資料庫連接失敗

**錯誤訊息：** `could not connect to server` 或 `connection refused`

**解決方法：**

- 確認資料庫服務正在運行
- 檢查連接字串是否正確
- 確認防火牆設定

### 問題 2: Migration 失敗

**錯誤訊息：** `relation already exists` 或 `table already exists`

**解決方法：**

- 如果資料庫已有資料，可以跳過 migration
- 或使用 `alembic downgrade base` 清除所有 migration，然後重新執行

### 問題 3: Seed 資料失敗

**錯誤訊息：** `table does not exist`

**解決方法：**

- 先執行 migration 建立資料表
- 確認 migration 已成功執行

## 檢查結果

```bash
# 連接到資料庫檢查資料
psql postgresql://postgres:postgres@localhost:5432/road_safety_db

# 在 psql 中執行
SELECT COUNT(*) FROM accidents;
SELECT COUNT(*) FROM hotspots;
```


# alembic db schema
```
docker-compose exec backend alembic upgrade head
```

# seed
```
docker-compose exec backend python -m src.scripts.seed_data --clear
```

# dev 環境
```
uv pip install -e ".[dev]"
```