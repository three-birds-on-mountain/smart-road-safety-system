# 測試資料庫說明

## 資料庫分離

**重要**：測試使用獨立的測試資料庫，不會影響正式服務的資料庫。

### 資料庫配置

| 環境 | 資料庫名稱 | 用途 |
|------|-----------|------|
| 正式服務 | `road_safety_db` | 生產/開發環境的實際資料 |
| 測試 | `road_safety_db_test` | 測試專用，每次測試會建立和刪除資料表 |

### 資料庫 URL

- **正式服務**：`postgresql://postgres:postgres@postgres:5432/road_safety_db`
- **測試**：`postgresql://postgres:postgres@postgres:5432/road_safety_db_test`

### 測試資料庫行為

1. **每個測試函數獨立**：使用 `@pytest.fixture(scope="function")`，每個測試函數都會：
   - 建立新的資料表（`Base.metadata.create_all()`）
   - 執行測試
   - 刪除資料表（`Base.metadata.drop_all()`）

2. **不會影響正式資料庫**：測試只會操作 `road_safety_db_test`，不會觸碰到 `road_safety_db`

3. **測試資料隔離**：每個測試的資料都是獨立的，不會互相影響

## 設定測試資料庫

### 方法 1: 使用環境變數（推薦）

```bash
# 設定測試資料庫 URL
export TEST_DATABASE_URL="postgresql://postgres:postgres@postgres:5432/road_safety_db_test"

# 執行測試
docker-compose exec backend pytest tests/
```

### 方法 2: 使用預設配置

`conftest.py` 會自動設定測試資料庫 URL，無需額外配置。

## 建立測試資料庫

在第一次執行測試前，需要建立測試資料庫：

```bash
# 建立測試資料庫
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE road_safety_db_test;"

# 執行 migration（可選，因為測試會自動建立資料表）
docker-compose exec backend \
  DATABASE_URL="postgresql://postgres:postgres@postgres:5432/road_safety_db_test" \
  alembic upgrade head
```

## 驗證資料庫分離

### 檢查正式資料庫

```bash
# 連接到正式資料庫
docker-compose exec postgres psql -U postgres -d road_safety_db

# 查看資料表
\dt

# 查看資料數量
SELECT COUNT(*) FROM accidents;
SELECT COUNT(*) FROM hotspots;
```

### 檢查測試資料庫

```bash
# 連接到測試資料庫
docker-compose exec postgres psql -U postgres -d road_safety_db_test

# 查看資料表（測試執行時才會存在）
\dt
```

## 安全機制

1. **環境變數檢查**：`conftest.py` 會檢查資料庫 URL 是否包含 "test"，如果沒有會發出警告

2. **資料庫名稱驗證**：測試資料庫名稱必須包含 "test" 或 "road_safety_db_test"

3. **自動清理**：每個測試結束後會自動刪除資料表，確保測試之間不會互相影響

## 注意事項

⚠️ **重要**：
- 測試會建立和刪除資料表，但**不會刪除資料庫本身**
- 測試資料庫的資料在測試執行期間是臨時的
- 如果測試失敗，資料表可能會殘留，但不影響正式資料庫
- 可以手動清理測試資料庫：`docker-compose exec postgres psql -U postgres -c "DROP DATABASE road_safety_db_test; CREATE DATABASE road_safety_db_test;"`

