# Data Utilities

## MOI A1 事故資料（每週整批覆蓋）

`fetch_moi_a1.py` 會直接呼叫 MOI 提供的 A1 CSV 下載連結，並覆蓋 `data/moi_a1/records.csv`，確保資料永遠是最新週的內容。同時保留原始 CSV（`source.csv`）與 metadata，metadata 內也會紀錄官方欄位清單與實際欄位，方便比對。若設定 `DATABASE_URL`，腳本會自動將資料匯入 PostgreSQL（預設表 `raw_moi_a1`，或以 `--table-name` 指定）。

### 如何執行

```bash
# 從專案根目錄
uv run python data/fetch_moi_a1.py
```

若 API 需要自訂 URL 或輸出位置，可搭配以下參數：

- `--source-url`：資料集下載位址
- `--dataset-subdir` / `--output-dir`：變更輸出資料夾
- `--timeout`：HTTP 請求逾時秒數
- `--database-url`：PostgreSQL 連線字串（例如 `postgresql://user:pass@host:5432/db`）
- `--table-name`：儲存資料的資料表名稱（預設 `raw_moi_a1`）

### 產生的檔案

- `data/moi_a1/records.csv`：轉存後的最新資料
- `data/moi_a1/source.csv`：保留的原始 CSV 內容
- `data/moi_a1/metadata.json`：記錄來源 URL、欄位清單、筆數、下載時間等資訊
- PostgreSQL：`raw_moi_a1`（或自訂 `--table-name`）會被 TRUNCATE 後寫入最新資料

### 排程建議

1. 透過 cron / systemd timer / Airflow 等排程工具，每週固定時間執行 `uv run python data/fetch_moi_a1.py`
2. 若需要監控資料提供日期，可在排程腳本中讀取 `metadata.json` 內的 `資料提供日期` 或 `downloaded_at` 欄位

---

## MOI A3 事故資料（每週整批覆蓋）

`fetch_moi_a3.py` 會呼叫 MOI 提供的 A3 CSV 下載連結，將檔案抓下來並覆蓋 `data/moi_a3/records.csv`。同時保留原始檔（`source.csv`）與 metadata，方便追蹤下載時間、筆數與來源 URL。如果有設定 `DATABASE_URL`，也會同步覆蓋 PostgreSQL（預設表 `raw_moi_a3`）。

### 如何執行

```bash
# 從專案根目錄
uv run python data/fetch_moi_a3.py
```

需要調整來源或輸出位置時，可搭配：

- `--source-url`：資料集下載位址
- `--dataset-subdir` / `--output-dir`：變更輸出資料夾
- `--timeout`：HTTP 請求逾時秒數
- `--database-url`：PostgreSQL 連線字串
- `--table-name`：儲存資料的資料表名稱（預設 `raw_moi_a3`）

### 產生的檔案

- `data/moi_a3/records.csv`：轉存後的最新資料
- `data/moi_a3/source.csv`：保留的原始 CSV 內容
- `data/moi_a3/metadata.json`：記錄來源 URL、筆數、下載時間等資訊
- PostgreSQL：`raw_moi_a3`（或自訂 `--table-name`）會被 TRUNCATE 後寫入最新資料

### 排程建議

1. 使用 cron / systemd timer / Airflow 等工具，每週固定時間執行 `uv run python data/fetch_moi_a3.py`
2. 如需驗證資料是否更新，可查看 `metadata.json` 的 `downloaded_at` 或與前一週的 `record_count` 比較
