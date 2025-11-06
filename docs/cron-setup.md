# Cron 設定文件：智慧道路守護系統

## 熱點分析 Cron 設定

### 說明
每日自動執行 DBSCAN 聚類分析，識別過去一年內的事故熱點。

### Crontab 設定

```bash
# 每日凌晨 3:00 執行熱點分析（資料擷取之後）
0 3 * * * cd /path/to/smart-road-safety-system/backend && /usr/local/bin/uv run python -m src.scripts.analyze_hotspots >> /var/log/road-safety/analysis.log 2>&1
```

### 執行方式

1. **直接執行（開發環境）**:
   ```bash
   cd backend
   uv run python -m src.scripts.analyze_hotspots
   ```

2. **透過 API 端點（推薦）**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/admin/analyze-hotspots \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "analysis_period_days": 365,
       "epsilon_meters": 500,
       "min_samples": 5
     }'
   ```

3. **Docker 環境**:
   ```bash
   docker-compose exec backend uv run python -m src.scripts.analyze_hotspots
   ```

### 參數說明
- `analysis_period_days`: 分析過去幾天的事故資料（預設：365天）
- `epsilon_meters`: DBSCAN epsilon參數（公尺，預設：500）
- `min_samples`: DBSCAN min_samples參數（最小事故數，預設：5）

### 注意事項
- 建議在資料擷取完成後執行
- 執行時間可能較長（取決於資料量）
- 監控日誌檔案以確認執行狀態
- 定期清理舊的熱點分析結果（保留90天）
