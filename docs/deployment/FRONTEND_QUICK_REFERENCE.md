# 快速參考卡：前端部署

**專案**：Smart Road Safety System Frontend
**最後更新**：2025-11-08

---

## 一鍵部署命令

```bash
# 1. 設定專案
gcloud config set project three-birds-on-mountain
gcloud config set compute/region asia-east1

# 2. 建置映像（在 frontend 目錄下執行）
cd frontend
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_VITE_API_BASE_URL="https://road-safety-backend-303764303193.asia-east1.run.app/api/v1",_VITE_MAPBOX_ACCESS_TOKEN="pk.eyJ1IjoiamFja3kxMjM0IiwiYSI6ImNtaGhkZzNsaTBlNjEyanByMnFoNmgxa3YifQ.VaQAfhvfNj4UaWSoxFVVjg"

# 3. 部署服務
gcloud run deploy road-safety-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1 \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated

# 4. 更新後端 CORS（如需要）
cd ../backend
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="CORS_ORIGINS=https://road-safety-frontend-303764303193.asia-east1.run.app"
```

---

## 服務資訊

**服務名稱**：`road-safety-frontend`
**服務 URL**：`https://road-safety-frontend-303764303193.asia-east1.run.app`
**Health Endpoint**：`/health`
**後端 API**：`https://road-safety-backend-303764303193.asia-east1.run.app/api/v1`

---

## 常用命令

### 查看服務狀態
```bash
gcloud run services describe road-safety-frontend --region=asia-east1
```

### 取得服務 URL
```bash
gcloud run services describe road-safety-frontend \
  --region=asia-east1 --format="value(status.url)"
```

### 測試健康檢查
```bash
curl https://road-safety-frontend-303764303193.asia-east1.run.app/health
```

### 查看日誌
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend" \
  --limit=50
```

### 即時監控日誌
```bash
gcloud logging tail \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend"
```

### 更新程式碼
```bash
# 1. 重新建置
cd frontend
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_VITE_API_BASE_URL="https://road-safety-backend-303764303193.asia-east1.run.app/api/v1",_VITE_MAPBOX_ACCESS_TOKEN="你的_TOKEN"

# 2. 重新部署
gcloud run deploy road-safety-frontend \
  --image=asia-east1-docker.pkg.dev/three-birds-on-mountain/containers/frontend:latest \
  --region=asia-east1
```

### 列出所有版本
```bash
gcloud run revisions list --service=road-safety-frontend --region=asia-east1
```

### 回滾到特定版本
```bash
gcloud run services update-traffic road-safety-frontend \
  --region=asia-east1 \
  --to-revisions=road-safety-frontend-00001-xxx=100
```

---

## 環境變數

### 建置時變數（需要重新建置才能更新）
| 變數 | 當前值 |
|------|--------|
| VITE_API_BASE_URL | `https://road-safety-backend-303764303193.asia-east1.run.app/api/v1` |
| VITE_MAPBOX_ACCESS_TOKEN | `pk.eyJ1...` |
| VITE_USE_MOCK_API | `false` |
| VITE_FALLBACK_TO_MOCK | `false` |
| VITE_DISABLE_MOCK_PREVIEW | `true` |

### 執行時變數
| 變數 | 當前值 |
|------|--------|
| PORT | `8080` |

---

## 故障排除

### 問題：容器啟動失敗 (PORT 錯誤)
**檢查**：
1. Dockerfile 是否安裝 `gettext` 套件
2. CMD 是否使用 `envsubst`
3. nginx.conf 是否使用 `$PORT` 變數

**快速修復**：
```bash
# 檢查 Dockerfile
grep "gettext" frontend/Dockerfile

# 檢查 nginx.conf
grep "listen" frontend/docker/nginx.conf
```

### 問題：Nginx 設定錯誤
**檢查日誌**：
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend AND severity>=ERROR" \
  --limit=10
```

**常見錯誤**：
- `invalid value "must-revalidate"` → 修正 `gzip_proxied` 參數

### 問題：CORS 錯誤
**解決**：更新後端 CORS 設定
```bash
gcloud run services update road-safety-backend \
  --region=asia-east1 \
  --update-env-vars="CORS_ORIGINS=https://road-safety-frontend-303764303193.asia-east1.run.app"
```

### 問題：還在使用 Mock 資料
**檢查**：
1. 瀏覽器開發者工具 → Network 標籤
2. 確認 API 請求是否指向真實後端

**解決**：重新建置並確認環境變數
```bash
# 確認 Dockerfile 包含以下設定
ENV VITE_USE_MOCK_API=false
ENV VITE_FALLBACK_TO_MOCK=false
ENV VITE_DISABLE_MOCK_PREVIEW=true
```

### 問題：Cloud Build 失敗
**常見原因**：
1. 變數未定義（如 `${SHORT_SHA}`）
2. 網路超時
3. 權限不足

**解決**：
```bash
# 檢查 cloudbuild.yaml 語法
cat frontend/cloudbuild.yaml

# 使用較高效能機器
# 在 cloudbuild.yaml 中加入：
options:
  machineType: 'N1_HIGHCPU_8'
```

---

## 資源限制

- **Memory**: 512Mi
- **CPU**: 1 core
- **Min Instances**: 0
- **Max Instances**: 10
- **Concurrency**: 80

---

## 調整資源配置

### 降低成本（如效能足夠）
```bash
gcloud run services update road-safety-frontend \
  --region=asia-east1 \
  --memory=256Mi \
  --cpu=0.5
```

### 提升效能（高流量）
```bash
gcloud run services update road-safety-frontend \
  --region=asia-east1 \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=20
```

### 避免冷啟動
```bash
gcloud run services update road-safety-frontend \
  --region=asia-east1 \
  --min-instances=1
```

---

## 重要提醒

⚠️ **建置時環境變數**：
- Vite 變數（`VITE_*`）是在建置時編譯進程式碼的
- 修改這些變數需要重新建置 Docker 映像
- 無法透過 `gcloud run services update` 更新

⚠️ **安全性**：
- 生產環境移除 `--allow-unauthenticated`
- 使用 Secret Manager 管理敏感資料
- 定期更新依賴套件

⚠️ **效能**：
- 建置時間約 60-70 秒
- 冷啟動延遲約 1-3 秒
- 使用 `min-instances=1` 可避免冷啟動

⚠️ **成本**：
- 無流量時使用 `min-instances=0` 不產生費用
- 每月預估成本約 $5-10 USD（基於目前設定）

---

## 快速驗證檢查清單

部署完成後，執行以下檢查：

```bash
# ✓ 1. 健康檢查
curl https://road-safety-frontend-303764303193.asia-east1.run.app/health

# ✓ 2. 首頁載入
curl -I https://road-safety-frontend-303764303193.asia-east1.run.app

# ✓ 3. 後端 API 連通性
curl https://road-safety-backend-303764303193.asia-east1.run.app/api/v1/health

# ✓ 4. 查看最新日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=road-safety-frontend" \
  --limit=5

# ✓ 5. 瀏覽器測試
# 開啟 https://road-safety-frontend-303764303193.asia-east1.run.app
# 檢查：
# - 頁面正常載入
# - 地圖顯示正常
# - Network 標籤無 CORS 錯誤
# - API 請求指向真實後端（非 mock）
```

---

## 緊急聯絡資訊

- **Cloud Console**：https://console.cloud.google.com
- **專案 ID**：three-birds-on-mountain
- **區域**：asia-east1
- **文件位置**：`docs/deployment/FRONTEND_DEPLOYMENT.md`
