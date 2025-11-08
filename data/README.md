# Data Utilities

## 共用行為

- 三隻 `fetch_moi_a*.py` 都會將 MOI 官方欄位轉換成英文欄位名稱後寫入 PostgreSQL，並自動補上 `accident_level`（固定為 A1/A2/A3）與 `etl_dt`（UTC 時間戳）。
- 需要將資料匯入資料庫時，請設定 `DATABASE_URL`（例如 `postgresql://user:pass@host:5432/dbname`）並安裝 `psycopg2` 或 `psycopg2-binary`。
- 可以透過 `--local-csv` 指定既有的 CSV，如 `~/moi_a1/A1_2025.csv`、`~/moi_a3/A3_2025.csv` 或 `data/moi_a2/A2_202501.csv`；若未提供，A1/A3 預設改為下載最新檔案，而 A2 會自動尋找 `data/moi_a2/A2_*.csv` 中最新的檔案。
- 每次執行都會重新產生 `records.csv`、保留 `source.csv`、更新 `metadata.json`，metadata 會同時紀錄中文欄位、英文欄位、`accident_level`、`downloaded_at`、是否使用本地檔案等資訊。

---

## MOI A1 事故資料（每週整批覆蓋）

`fetch_moi_a1.py` 會下載官方 A1 CSV，或使用 `--local-csv` 指定的檔案（若系統偵測到 `~/moi_a1/A1_2025.csv` 也會自動採用）。轉存後會覆蓋 `data/moi_a1/records.csv`，並在 PostgreSQL（預設 `raw_moi_a1`）以英文欄位寫入資料，再附上 `accident_level='A1'` 與 `etl_dt`。

### 如何執行

```bash
# 從專案根目錄
uv run python data/fetch_moi_a1.py \
  --database-url "$DATABASE_URL" \
  --local-csv ~/moi_a1/A1_2025.csv
```

常用參數：

- `--source-url`：資料集下載位址
- `--dataset-subdir` / `--output-dir`：變更輸出資料夾
- `--timeout`：HTTP 請求逾時秒數
- `--database-url`：PostgreSQL 連線字串
- `--table-name`：儲存資料的資料表名稱（預設 `raw_moi_a1`）
- `--accident-level`：覆寫寫入資料庫的嚴重度欄位值（預設 `A1`）
- `--local-csv`：優先使用的本地 CSV 檔案

### 產生的檔案

- `data/moi_a1/records.csv`：轉存後的最新資料
- `data/moi_a1/source.csv`：保留的原始 CSV 內容
- `data/moi_a1/metadata.json`：紀錄來源 URL、欄位清單、筆數、下載時間、英文欄位、`accident_level` 等資訊
- PostgreSQL：`raw_moi_a1`（或自訂 `--table-name`）會被 TRUNCATE 後寫入最新資料

---

## MOI A2 事故資料（人工提供的整批覆蓋）

`fetch_moi_a2.py` 主要面向離線 CSV。預設會自動挑選 `data/moi_a2` 目錄內最新的 `A2_*.csv`，也可以用 `--local-csv` 指定檔案；若仍需要下載，可以加上 `--source-url`。流程與 A1 相同：輸出 `records.csv` / `source.csv` / `metadata.json`，並以英文欄位、`accident_level='A2'`、`etl_dt` 覆蓋 PostgreSQL（預設 `raw_moi_a2`）。

### 如何執行

```bash
# fetch
# 自動偵測 data/moi_a2/A2_*.csv
uv run python data/fetch_moi_a2.py --database-url "$DATABASE_URL"


# 使用絕對路徑
uv run python fetch_moi_a1.py \
  --database-url "$DATABASE_URL" \
  --local-csv /Users/claireliang/Desktop/mytest/three-birds-on-mountain/smart-road-safety-system/data/moi_a1/A1_2025.csv

# 指定其他檔案
uv run python data/fetch_moi_a2.py --local-csv ~/Downloads/A2_202503.csv

# load_moi_a*.py
uv run python load_moi_a3.py --csv-path moi_a3/A3_2025.csv
uv run python load_moi_a2.py
uv run python load_moi_a1.py --csv-path moi_a1/A1_2025.csv

```

常用參數與 A1 類似（`--dataset-subdir`、`--output-dir`、`--table-name`、`--accident-level`、`--database-url`、`--local-csv`、`--source-url`）。若未提供本地檔案且 `--source-url` 為空，腳本會直接終止以避免寫入空資料。

---

## MOI A3 事故資料（每週整批覆蓋）

`fetch_moi_a3.py` 會下載官方 A3 CSV，或使用 `--local-csv`（預設偵測 `~/moi_a3/A3_2025.csv`）。產出內容與 A1 類似，寫入 PostgreSQL（預設 `raw_moi_a3`）時同樣會使用英文欄位並附上 `accident_level='A3'`、`etl_dt`。

### 如何執行

```bash
uv run python data/fetch_moi_a3.py \
  --database-url "$DATABASE_URL" \
  --local-csv ~/moi_a3/A3_2025.csv
```

可用參數：

- `--source-url`：資料集下載位址
- `--dataset-subdir` / `--output-dir`：變更輸出資料夾
- `--timeout`：HTTP 請求逾時秒數
- `--database-url`：PostgreSQL 連線字串
- `--table-name`：儲存資料的資料表名稱（預設 `raw_moi_a3`）
- `--accident-level`：覆寫寫入資料庫的嚴重度欄位值（預設 `A3`）
- `--local-csv`：優先使用的本地 CSV 檔案
