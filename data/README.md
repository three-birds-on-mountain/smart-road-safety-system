# Data Utilities

## MOI A1 事故資料增量收集腳本

`fetch_moi_a1.py` 會記錄上次抓取到的 offset，下一次執行就從該位置往下抓，避免重複下載舊資料。預設把新資料追加到 `data/moi_a1/records.csv`，並把狀態寫進 `data/moi_a1/metadata.json`。

### 如何執行

```bash
# 從專案根目錄
uv run python data/fetch_moi_a1.py              # 正常抓資料並寫入 CSV
uv run python data/fetch_moi_a1.py --dry-run    # 只檢查是否有新資料，不寫檔
uv run python data/fetch_moi_a1.py --reset-offset   # 忽略 metadata，從 0 開始重抓
```

執行完成會看到類似訊息：

```
Completed ingestion. Processed 3200 API rows and wrote 3180 records to data/moi_a1/records.csv.
```

### 產生的檔案

- `data/moi_a1/records.csv` 或 `records.jsonl`：累積的原始資料（依 `--format` 決定）
- `data/moi_a1/metadata.json`：儲存 `dataset_key`、`last_offset`、`last_total`、`stored_records`、`last_run_at`、`last_checked_at`

### 常用參數

- `--limit`：單次呼叫 API 的筆數，預設 3000
- `--base-url`：完整 API URL（預設為 MOI A1 資料集，若要抓其他資源可覆寫）
- `--format`：`csv`（預設）或 `jsonl`
- `--dataset-subdir` / `--output-dir`：調整資料與 metadata 儲存路徑
- `--dry-run`：只檢查有沒有新資料
- `--reset-offset`：刪除既有 offset，從 0 重抓

### 排程建議

1. 使用 cron、systemd timer 或 Airflow 每週執行 `uv run python data/fetch_moi_a1.py`
2. 先加上 `--dry-run` 檢查是否有新資料，再視需要進行正式抓取
3. 若發現 API 筆數被重置或 metadata 受損，可刪除 `data/moi_a1/metadata.json` 或直接加上 `--reset-offset`

### 檢查資料是否更新

1. 執行 `uv run python data/fetch_moi_a1.py --dry-run`，若看到 `No new rows...` 表示目前已同步
2. 手動打開 `data/moi_a1/metadata.json`，若 `last_total` 與 `last_offset` 相同，也代表沒有新資料
