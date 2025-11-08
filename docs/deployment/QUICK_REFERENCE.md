# 快速參考卡：後端部署

**專案**：Smart Road Safety System Backend
**最後更新**：2025-11-08

---

## 一鍵部署命令

```bash
# 1. 設定專案
gcloud config set project three-birds-on-mountain
gcloud config set compute/region asia-east1

# 2. 建置映像
gcloud builds submit \
  --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest

# 3. 部署服務
gcloud run deploy road-safety-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1 \
  --add-cloudsql-instances=three-birds-on-mountain:asia-east1:tpml-seat-tracker-db \
  --set-env-vars="DATABASE_URL=postgresql://road_safety_user:PASSWORD@/road_safety_db?host=/cloudsql/three-birds-on-mountain:asia-east1:tpml-seat-tracker-db,CORS_ORIGINS=*,LOG_LEVEL=INFO" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --allow-unauthenticated
```

---

## 服務資訊

**服務名稱**：`road-safety-backend`
**服務 URL**：`https://road-safety-backend-303764303193.asia-east1.run.app`
**Health Endpoint**：`/api/v1/health`
**API 文件**：`/docs`

---

## 常用命令

### 查看服務狀態
```bash
gcloud run services describe road-safety-backend --region=asia-east1
```

### 取得服務 URL
```bash
gcloud run services describe road-safety-backend \
  --region=asia-east1 --format="value(status.url)"
```

### 測試健康檢查
```bash
curl https://road-safety-backend-303764303193.asia-east1.run.app/api/v1/health
```

### 查看日誌
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-backend" \
  --limit=50
```

### 更新環境變數
```bash
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="LOG_LEVEL=DEBUG"
```

### 更新程式碼
```bash
# 1. 重新建置
gcloud builds submit --tag asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest

# 2. 重新部署
gcloud run deploy road-safety-backend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/backend:latest \
  --region=asia-east1
```

---

## 環境變數

| 變數 | 當前值 |
|------|--------|
| DATABASE_URL | `postgresql://road_safety_user:***@/road_safety_db?host=/cloudsql/...` |
| CORS_ORIGINS | `*` |
| LOG_LEVEL | `INFO` |
| PORT | `8080` |

---

## 故障排除

### 問題：容器啟動失敗
**檢查**：Dockerfile 是否使用 `${PORT:-8080}`

### 問題：資料庫連線失敗
**檢查**：
1. DATABASE_URL 格式是否正確
2. Cloud SQL 實例連接設定
3. 資料庫密碼是否正確

### 問題：CORS 錯誤
**解決**：更新 CORS_ORIGINS 環境變數
```bash
gcloud run services update road-safety-backend \
  --update-env-vars="CORS_ORIGINS=https://frontend-url"
```

---

## 資源限制

- **Memory**: 512Mi
- **CPU**: 1 core
- **Min Instances**: 0
- **Max Instances**: 10

---

## 重要提醒

⚠️ 記得將 `.env.deploy` 加入 `.gitignore`
⚠️ 生產環境移除 `--allow-unauthenticated`
⚠️ 使用 Secret Manager 管理敏感資料
⚠️ 定期檢查服務日誌和指標
