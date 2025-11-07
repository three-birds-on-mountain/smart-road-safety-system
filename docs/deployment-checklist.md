# Deployment Checklist

部署前請依序檢查以下項目，確保系統可正常運作。

## 1. 環境準備

### 1.1 基礎設施
- [ ] PostgreSQL + PostGIS 15-3.4 已安裝並運行
- [ ] 資料庫備份策略已設定（每日備份 + 30 天保留）
- [ ] 監控與日誌系統已設定（CloudWatch / Stackdriver / ELK）
- [ ] SSL/TLS 憑證已設定（Let's Encrypt 或商業憑證）

### 1.2 環境變數與秘密管理
- [ ] Mapbox Access Token 已設定於 CI/CD Secret
- [ ] Google Maps API Key 已設定於 CI/CD Secret
- [ ] `ADMIN_JWT_SECRET` 使用強密碼（至少 32 字元隨機字串）
- [ ] 所有必要環境變數已設定（參考 `docs/environment-variables.md`）
- [ ] 生產環境已設定 `ENVIRONMENT=production`
- [ ] 已設定適當的 `LOG_LEVEL`（建議 `WARNING` 或 `ERROR`）

## 2. 後端部署

### 2.1 程式碼與依賴
- [ ] 後端程式碼已更新至最新版本
- [ ] `backend/pyproject.toml` 依賴版本已鎖定
- [ ] Docker 映像已建置並推送至 registry（含版本 tag）
- [ ] `backend/Dockerfile` 使用 multi-stage build 優化大小

### 2.2 資料庫遷移
- [ ] 本地環境已測試資料庫遷移：`alembic upgrade head`
- [ ] 生產環境執行資料庫遷移前已備份
- [ ] 遷移腳本已驗證（包含 PostGIS 擴充、索引建立）
- [ ] 已驗證 Trigger 正確運作（`accidents_updated_at_trigger`, `hotspots_updated_at_trigger`）

### 2.3 測試與驗證
- [ ] 所有單元測試通過：`uv run pytest tests/unit`
- [ ] 所有整合測試通過：`uv run pytest tests/integration`
- [ ] Contract 測試通過（驗證 OpenAPI 契約一致性）
- [ ] 測試覆蓋率達到 80% 以上：`uv run pytest --cov=src --cov-report=term`
- [ ] API 參數驗證正常（422 錯誤回傳正確的中文訊息）

### 2.4 API 端點驗證
- [ ] `GET /health` 回傳正常
- [ ] `GET /api/v1/hotspots/nearby` 正常查詢熱點
- [ ] `GET /api/v1/hotspots/in-bounds` 正常查詢地圖邊界內熱點
- [ ] `GET /api/v1/hotspots/{id}` 正常回傳熱點詳細資訊
- [ ] Rate limiting 正常運作（60 req/min）
- [ ] Admin 端點需要 JWT 認證

## 3. 前端部署

### 3.1 建置與測試
- [ ] 前端程式碼已更新至最新版本
- [ ] `npm install` 完成且無警告
- [ ] `npm run build` 建置成功
- [ ] `npm run test` 所有測試通過
- [ ] `npm run test:coverage` 測試覆蓋率達到 80% 以上
- [ ] `npm run lint` 無錯誤

### 3.2 環境配置
- [ ] `VITE_API_BASE_URL` 指向正確的後端 API（含 `/api/v1`）
- [ ] `VITE_MAPBOX_ACCESS_TOKEN` 已設定
- [ ] 生產環境已停用 mock API：`VITE_USE_MOCK_API=false`
- [ ] Bundle size 已驗證（Mapbox SDK < 500KB）

### 3.3 功能驗證
- [ ] 地圖正常載入（Mapbox GL JS）
- [ ] 熱點標記正確顯示（含事故件數標籤）
- [ ] 點擊熱點標記可聚焦並顯示詳情彈窗
- [ ] GPS 定位正常運作（或 Flutter WebView bridge 正常）
- [ ] 警示系統正常觸發（音效/震動/視覺提示）
- [ ] 設定頁面正常運作（距離/事故等級/時間範圍/警示方式）
- [ ] 全屏事故詳情列表正常顯示

## 4. 整合測試

### 4.1 Docker Compose 驗證
- [ ] `docker-compose up` 可同時啟動 postgres、backend、frontend
- [ ] 容器間網路連接正常（frontend 可透過 `backend:8000` 連接）
- [ ] PostgreSQL healthcheck 正常運作
- [ ] 所有服務啟動後無錯誤日誌

### 4.2 前後端整合
- [ ] 前端可正常呼叫後端 API
- [ ] 時間範圍參數格式正確（`1_month`, `3_months`, `6_months`, `1_year`）
- [ ] 地圖邊界參數格式正確（`sw_lat`, `sw_lng`, `ne_lat`, `ne_lng`）
- [ ] 事故等級篩選正常運作（A1/A2/A3）
- [ ] 錯誤處理正常（422/400/404 錯誤顯示中文訊息）

### 4.3 Flutter WebView 整合（如適用）
- [ ] Flutter JS Bridge 通訊正常
- [ ] `requestLocation()` 可正確回傳位置
- [ ] `sendNotification()` 可正確發送通知
- [ ] 優雅降級處理正常（bridge 不可用時顯示錯誤訊息）

### 4.4 E2E 測試（可選）
- [ ] 地圖載入與熱點顯示 E2E 測試通過
- [ ] 警示觸發 E2E 測試通過（模擬 GPS 移動）
- [ ] 設定變更 E2E 測試通過

## 5. 效能與安全

### 5.1 效能優化
- [ ] API 回應時間 < 500ms（`/hotspots/nearby`）
- [ ] PostGIS 索引正常使用（透過 `EXPLAIN ANALYZE` 驗證）
- [ ] 前端 Code Splitting 正常運作（Mapbox SDK lazy loading）
- [ ] Redis Cache 正常運作（5 分鐘快取）
- [ ] 資料庫連線池設定合理（max connections）

### 5.2 安全性
- [ ] CORS 已限制為特定來源（非 `*`）
- [ ] Rate limiting 已啟用（60 req/min）
- [ ] Admin 端點需要 JWT 認證
- [ ] SQL Injection 防護已驗證（使用 SQLAlchemy ORM）
- [ ] XSS 防護已驗證（React 自動轉義）
- [ ] 敏感資訊不會記錄在日誌中

## 6. 運維設定

### 6.1 資料擷取與分析
- [ ] Cron job 已設定：每月 1 號凌晨 2 點執行 `/api/v1/admin/ingest`
- [ ] Cron job 已設定：每日凌晨 3 點執行 `/api/v1/admin/analyze-hotspots`
- [ ] 資料擷取日誌正常記錄（成功筆數、失敗筆數）
- [ ] 熱點分析日誌正常記錄（熱點數量、事故覆蓋率）

### 6.2 監控與告警
- [ ] API latency 監控已設定（目標 < 500ms）
- [ ] 錯誤率監控已設定（目標 < 1%）
- [ ] 資料庫連線數監控已設定
- [ ] 磁碟空間監控已設定（告警閾值 80%）
- [ ] CPU/Memory 監控已設定

## 7. 文件與流程

### 7.1 文件更新
- [ ] `README.md` 已更新（包含專案說明、安裝指南）
- [ ] `docs/environment-variables.md` 已同步最新變數
- [ ] `docs/deployment-checklist.md`（本文件）已更新
- [ ] `specs/001-road-safety-system/quickstart.md` 與實際流程一致
- [ ] API 文件已生成（FastAPI Swagger UI）

### 7.2 版本管理
- [ ] CHANGELOG 已更新
- [ ] Git commit 已標記版本 tag（例如 `v1.0.0`）
- [ ] Release notes 已撰寫

### 7.3 上線流程
- [ ] QA / PM 已完成 Smoke Test
- [ ] 已規劃回滾計畫（如部署失敗）
- [ ] 已通知相關人員（開發、運維、PM）
- [ ] 已設定上線時間窗口（建議非尖峰時段）

## 8. 上線後驗證

- [ ] 前端網站可正常存取 `https://<domain>`
- [ ] API 端點可正常存取 `https://<domain>/api/v1/health`
- [ ] 地圖正常載入並顯示熱點
- [ ] 警示系統正常運作
- [ ] 監控系統顯示正常指標
- [ ] 日誌系統正常記錄
- [ ] 備份系統正常運作

## 9. 緊急聯絡資訊

| 角色 | 姓名 | 聯絡方式 |
|------|------|----------|
| 技術負責人 | - | - |
| 運維負責人 | - | - |
| PM | - | - |

---

**注意事項**：
- 建議在非尖峰時段部署（例如週末凌晨）
- 部署前確保已備份資料庫
- 部署過程中持續監控系統狀態
- 如遇問題立即回滾至上一版本
