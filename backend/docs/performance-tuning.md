# 效能調優指南：智慧道路守護系統

## PostGIS 索引驗證

### 檢查索引狀態

```sql
-- 檢查 accidents 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'accidents';

-- 檢查 hotspots 表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'hotspots';

-- 檢查空間索引大小
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename IN ('accidents', 'hotspots')
AND indexdef LIKE '%gist%';
```

### 驗證索引使用情況

```sql
-- 啟用查詢計劃分析
EXPLAIN ANALYZE
SELECT * FROM hotspots
WHERE ST_DWithin(
    geom,
    ST_SetSRID(ST_MakePoint(121.5654, 25.0330), 4326)::geography,
    1000
);
```

### 索引維護建議

1. **定期重建索引**（每月）:
   ```sql
   REINDEX INDEX CONCURRENTLY idx_accident_geom;
   REINDEX INDEX CONCURRENTLY idx_hotspot_geom;
   ```

2. **更新統計資訊**（每週）:
   ```sql
   ANALYZE accidents;
   ANALYZE hotspots;
   ```

3. **檢查索引使用率**:
   ```sql
   SELECT 
       schemaname,
       tablename,
       indexname,
       idx_scan,
       idx_tup_read,
       idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE tablename IN ('accidents', 'hotspots');
   ```

### 效能優化建議

1. **查詢優化**:
   - 使用 `ST_DWithin` 而非 `ST_Distance`
   - 限制查詢結果數量（LIMIT）
   - 使用最新的分析結果（analysis_date）

2. **資料清理**:
   - 定期清理舊事故記錄（保留3年）
   - 定期清理舊熱點分析（保留90天）

3. **連線池設定**:
   - 調整 SQLAlchemy pool size
   - 使用 connection pooling


