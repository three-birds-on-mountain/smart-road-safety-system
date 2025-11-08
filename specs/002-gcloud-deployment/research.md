# 研究文件：Google Cloud Run 部署

**功能**: Google Cloud Run 部署
**日期**: 2025-11-08
**相關**: [spec.md](./spec.md) | [plan.md](./plan.md)

## 研究目的

本文件記錄部署智慧道路守護系統到 Google Cloud Run 所需的技術決策和最佳實踐研究。主要研究領域包括：資料庫連線策略、容器化建置流程、部署自動化、以及服務監控和維護。

## 研究議題

### 1. Cloud SQL 資料庫連線策略

#### 決策：使用 Unix Domain Socket

**選擇原因**:
- **安全性高**: 不經過網路，自動 TLS 加密
- **設定簡單**: 透過 Cloud SQL Proxy sidecar 自動處理
- **效能優異**: 本地 socket 比 TCP 連線更快
- **無需 IP 管理**: 不需要設定防火牆或 Public IP
- **避免 timeout**: 不會有網路超時問題

**實作方式**:
```python
# DATABASE_URL 格式
DATABASE_URL = "postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE"

# Cloud Run 部署參數
--add-cloudsql-instances=PROJECT:REGION:INSTANCE
```

**替代方案及拒絕原因**:

1. **Cloud SQL Python Connector**
   - ❌ 在 uvicorn 多 worker 環境下有 event loop 衝突問題
   - ❌ 初始化邏輯複雜，除錯困難
   - ❌ 增加額外依賴

2. **直接連 Public IP**
   - ❌ 需要設定防火牆規則
   - ❌ 可能遇到 timeout 問題
   - ❌ 需要管理 IP 白名單
   - ❌ 安全性較低

3. **Private IP (VPC Connector)**
   - ❌ 需要額外設定 VPC 和 Connector
   - ❌ 成本較高
   - ❌ 設定複雜度增加

**參考文件**:
- docs/deployment/cloud-run-deployment-guide.md (行 728-765)
- [Google Cloud: Connecting from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)

---

### 2. 後端 Dockerfile 最佳化

#### 決策：Multi-stage Build with uv Package Manager

**選擇原因**:
- **建置速度快**: uv 比 pip 快 10-100 倍
- **映像體積小**: Multi-stage build 只包含 runtime 需要的檔案
- **安全性**: 使用 Python 官方 slim 映像作為基底
- **快取友善**: 依賴和程式碼分層，提高建置快取效率

**Dockerfile 結構**:
```dockerfile
# Stage 1: Build dependencies
FROM python:3.12-slim as builder
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml ./
RUN uv pip install --system .

# Stage 2: Runtime
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY src ./src
COPY alembic ./alembic
COPY alembic.ini ./
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

**關鍵設定**:
- `--workers 2`: 提供基本並發處理，避免單點故障
- `PYTHONUNBUFFERED=1`: 確保日誌即時輸出到 Cloud Logging
- Health check: 使用 Cloud Run 內建機制，不在 Dockerfile 中設定

**替代方案及拒絕原因**:

1. **單階段建置**
   - ❌ 映像包含不必要的建置工具（如 gcc, make）
   - ❌ 映像大小 > 500MB（multi-stage < 200MB）

2. **使用 pip 而非 uv**
   - ❌ 建置時間長（首次建置 > 5 分鐘 vs. < 2 分鐘）
   - ❌ 依賴解析較慢

3. **uvicorn 單 worker**
   - ❌ 無法利用多核心
   - ❌ 單一請求阻塞會影響其他請求

**參考文件**:
- docs/deployment/cloud-run-deployment-guide.md (行 376-431)

---

### 3. 前端建置和部署策略

#### 決策：Vite + Nginx Multi-stage Build with Cloud Build

**選擇原因**:
- **建置時注入環境變數**: 透過 Cloud Build 的 `--substitutions` 參數
- **SPA 路由支援**: Nginx 設定 try_files 處理前端路由
- **安全標頭**: Nginx 設定 CSP、X-Frame-Options 等安全標頭
- **快取優化**: 靜態資源設定長期快取（1 年）
- **輕量映像**: 使用 nginx:alpine 作為 runtime

**Cloud Build 設定** (`cloudbuild.yaml`):
```yaml
steps:
  # Build step with environment variables
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'API_URL=${_API_URL}'
      - '--build-arg'
      - 'MAPBOX_TOKEN=${_MAPBOX_TOKEN}'
      - '-t'
      - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:latest'
      - '.'
images:
  - 'asia-east1-docker.pkg.dev/${PROJECT_ID}/containers/frontend:latest'
```

**Dockerfile 結構**:
```dockerfile
# Stage 1: Build
FROM node:20-alpine as builder
WORKDIR /app
ARG API_URL
ARG MAPBOX_TOKEN
ENV VITE_API_URL=$API_URL
ENV VITE_MAPBOX_TOKEN=$MAPBOX_TOKEN
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Nginx 設定重點**:
```nginx
# SPA 路由
location / {
    try_files $uri $uri/ /index.html;
}

# 安全標頭
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# 快取設定
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**替代方案及拒絕原因**:

1. **Runtime 環境變數注入**
   - ❌ Vite 建置時需要環境變數，無法在 runtime 注入
   - ❌ 需要複雜的 window.env.js 腳本

2. **使用 Cloud Run 的環境變數**
   - ❌ 前端是靜態檔案，無法讀取 runtime 環境變數
   - ❌ 需要額外的 server-side 邏輯

3. **不使用 Nginx，直接 serve 靜態檔案**
   - ❌ 缺少安全標頭設定
   - ❌ SPA 路由支援需要額外處理
   - ❌ 快取控制不靈活

**參考文件**:
- docs/deployment/DEPLOYMENT.md (行 73-117)
- docs/deployment/cloud-run-deployment-guide.md (行 1-45)

---

### 4. 環境變數管理和安全性

#### 決策：使用 Secret Manager + 環境變數組合

**選擇原因**:
- **安全性**: 敏感資料（如資料庫密碼）儲存在 Secret Manager
- **便利性**: 非敏感設定（如 CORS origins）使用環境變數
- **版本控制**: Secret Manager 支援版本管理和輪替
- **權限管理**: 透過 IAM 控制 Secret 存取權限

**實作方式**:

後端環境變數設定：
```bash
gcloud run deploy backend \
  --update-env-vars="DATABASE_URL=postgresql://user:password@/db?host=/cloudsql/..." \
  --update-env-vars="CORS_ORIGINS=https://frontend-url" \
  --update-env-vars="LOG_LEVEL=INFO" \
  --update-secrets="GOOGLE_MAPS_API_KEY=maps-api-key:latest" \
  --update-secrets="ADMIN_JWT_SECRET=jwt-secret:latest"
```

前端建置參數（透過 Cloud Build）:
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_API_URL="https://backend-url",_MAPBOX_TOKEN="pk.xxx"
```

**Secret Manager 設定**:
```bash
# 建立 secret
echo -n "secret-value" | gcloud secrets create secret-name --data-file=-

# 授權 Cloud Run 存取
gcloud secrets add-iam-policy-binding secret-name \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**替代方案及拒絕原因**:

1. **所有設定都用環境變數**
   - ❌ 敏感資料暴露在 Cloud Run 設定中
   - ❌ 無版本控制和輪替機制

2. **所有設定都用 Secret Manager**
   - ❌ 非敏感設定（如 LOG_LEVEL）也需要建立 secret，過於繁瑣
   - ❌ 增加 IAM 權限管理複雜度

3. **使用 .env 檔案**
   - ❌ 需要將 .env 檔案包含在 Docker 映像中，有安全風險
   - ❌ 無法在不重建映像的情況下更新設定

**參考文件**:
- docs/deployment/cloud-run-deployment-guide.md (行 207-258)

---

### 5. Alembic Migration 執行策略

#### 決策：使用 Cloud SQL Proxy 本地執行 Migration

**選擇原因**:
- **安全性**: 透過 Cloud SQL Proxy 建立加密連線
- **控制性**: 本地執行可以即時監控和中斷
- **簡單性**: 不需要在 Cloud Run 中執行 migration
- **驗證性**: Migration 完成後可立即驗證結果

**實作流程**:

1. **安裝 Cloud SQL Proxy**:
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy
mv cloud-sql-proxy ~/bin/
```

2. **啟動 Proxy**:
```bash
~/bin/cloud-sql-proxy --port 5432 PROJECT:REGION:INSTANCE
```

3. **設定環境變數**:
```bash
export DATABASE_URL="postgresql+psycopg2://USER:PASSWORD@127.0.0.1:5432/DATABASE"
```

4. **執行 Migration**:
```bash
cd backend
alembic upgrade head
```

5. **驗證**:
```bash
# 檢查版本
alembic current

# 檢查資料表
PGPASSWORD="password" psql -h 127.0.0.1 -U user -d database -c "\dt"
```

**替代方案及拒絕原因**:

1. **在 Cloud Run 啟動時執行 migration**
   - ❌ 多個實例同時啟動可能導致 migration 衝突
   - ❌ Migration 失敗會導致服務無法啟動
   - ❌ 難以監控和除錯

2. **使用 Cloud Build 執行 migration**
   - ❌ 需要設定 Cloud Build 的網路存取權限
   - ❌ Migration 失敗不會阻止部署繼續

3. **建立專用的 migration job**
   - ❌ 增加複雜度
   - ❌ 需要額外的權限設定

**參考文件**:
- docs/deployment/cloud-run-deployment-guide.md (行 520-639)

---

### 6. Cloud Run 資源配置和自動擴展

#### 決策：開發環境低成本配置 + 按需擴展

**選擇原因**:
- **成本優化**: min-instances=0 閒置時不產生費用
- **效能保證**: max-instances=10 限制最大成本
- **適當資源**: 512Mi 記憶體 + 1 CPU 足夠處理大部分請求

**後端配置**:
```bash
gcloud run deploy backend \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300s \
  --concurrency=80
```

**前端配置**:
```bash
gcloud run deploy frontend \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --port=80
```

**資源選擇理由**:

| 設定 | 後端 | 前端 | 理由 |
|------|------|------|------|
| Memory | 512Mi | 256Mi | 後端需要處理資料庫查詢和運算；前端只需 serve 靜態檔案 |
| CPU | 1 | 1 | 單核心足夠，多請求透過多實例處理 |
| Min Instances | 0 | 0 | 閒置時節省成本（開發環境） |
| Max Instances | 10 | 5 | 限制最大成本，前端需求較低 |
| Timeout | 300s | 60s | 後端可能有長時間查詢；前端快速回應 |
| Concurrency | 80 | 80 | 每個實例處理 80 個並發請求 |

**冷啟動優化**:
- 使用 multi-stage build 減少映像大小
- 預編譯 Python bytecode
- 資料庫連線池預熱（如需要）

**生產環境建議調整**:
```bash
# 後端
--min-instances=1  # 保持至少一個實例，避免冷啟動
--max-instances=50 # 增加最大實例數
--memory=1Gi      # 增加記憶體

# 前端
--min-instances=1
--max-instances=20
```

**替代方案及拒絕原因**:

1. **Always-on (min-instances=1)**
   - ❌ 開發環境持續產生費用
   - ✅ 生產環境建議使用

2. **更高資源配置（2Gi + 2 CPU）**
   - ❌ 成本高
   - ❌ 目前流量不需要

3. **無上限（max-instances=1000）**
   - ❌ 可能產生意外高額費用
   - ❌ 資料庫連線數可能不足

**參考文件**:
- docs/deployment/cloud-run-deployment-guide.md (行 465-506)
- [Cloud Run: Resource limits](https://cloud.google.com/run/docs/configuring/memory-limits)

---

### 7. CORS 設定策略

#### 決策：開發環境寬鬆 + 生產環境嚴格

**選擇原因**:
- **開發彈性**: 本地開發時允許所有 origins
- **生產安全**: 生產環境只允許已知的前端 URL
- **易於維護**: 透過環境變數切換

**實作方式**:

後端 middleware 設定：
```python
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import get_settings

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

環境變數設定：
```bash
# 開發環境
CORS_ORIGINS="*"

# 生產環境
CORS_ORIGINS="https://frontend-url.run.app,https://custom-domain.com"
```

Cloud Run 部署：
```bash
# 開發
gcloud run deploy backend --update-env-vars="CORS_ORIGINS=*"

# 生產
gcloud run deploy backend --update-env-vars="CORS_ORIGINS=https://frontend-url"
```

**前端 URL 更新流程**:
1. 部署前端取得新 URL
2. 更新後端 CORS_ORIGINS 環境變數
3. 前端即可正常呼叫後端 API

**替代方案及拒絕原因**:

1. **所有環境都用 "*"**
   - ❌ 生產環境安全風險
   - ❌ 容易受到 CSRF 攻擊

2. **寫死在程式碼中**
   - ❌ 每次 URL 改變都需要重新部署
   - ❌ 無法快速調整

3. **使用 allowlist 正則表達式**
   - ❌ 複雜且容易出錯
   - ❌ 明確列出 URL 更清楚

**參考文件**:
- docs/deployment/DEPLOYMENT.md (行 62-71)

---

### 8. 部署驗證和健康檢查

#### 決策：多層次驗證策略

**選擇原因**:
- **全面性**: 涵蓋建置、部署、服務、資料庫各層
- **自動化**: 透過腳本自動執行驗證
- **快速反饋**: 問題及早發現

**驗證層次**:

1. **建置驗證**:
```bash
# 驗證 Docker 映像建置成功
gcloud builds list --limit=1 --format="value(status)"
# 預期輸出: SUCCESS
```

2. **部署驗證**:
```bash
# 驗證服務部署成功
gcloud run services describe SERVICE_NAME --format="value(status.conditions[0].status)"
# 預期輸出: True
```

3. **服務健康檢查**:
```bash
# 後端 health endpoint
curl https://backend-url/api/v1/health
# 預期輸出: {"status":"healthy","database":"connected"}

# 前端首頁
curl -I https://frontend-url
# 預期輸出: HTTP/2 200
```

4. **資料庫連線驗證**:
```bash
# 透過 API 查詢資料
curl https://backend-url/api/v1/hotspots/nearby?lat=25.033&lng=121.5654&radius=1000
# 預期輸出: JSON 資料或空陣列（不應該是錯誤）
```

5. **整合測試**:
```bash
# 前端呼叫後端 API
curl https://frontend-url -v 2>&1 | grep -i cors
# 不應該有 CORS 錯誤
```

**Health Endpoint 設計**:
```python
@app.get("/api/v1/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        # 測試資料庫連線
        db.execute("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "timestamp": datetime.utcnow(),
        "database": db_status,
        "version": "1.0.0"
    }
```

**自動化驗證腳本** (`scripts/deploy/verify-deployment.sh`):
```bash
#!/bin/bash
set -e

echo "驗證後端部署..."
BACKEND_URL=$(gcloud run services describe backend --format="value(status.url)")
HEALTH=$(curl -s "$BACKEND_URL/api/v1/health")
if echo "$HEALTH" | grep -q "connected"; then
    echo "✓ 後端健康檢查通過"
else
    echo "✗ 後端健康檢查失敗"
    exit 1
fi

echo "驗證前端部署..."
FRONTEND_URL=$(gcloud run services describe frontend --format="value(status.url)")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$STATUS" = "200" ]; then
    echo "✓ 前端回應正常"
else
    echo "✗ 前端回應異常: $STATUS"
    exit 1
fi

echo "✓ 所有驗證通過"
```

**替代方案及拒絕原因**:

1. **只驗證部署成功**
   - ❌ 無法確認服務實際運作
   - ❌ 可能部署成功但服務無法啟動

2. **使用 Cloud Run 內建 health check**
   - ✅ 應該同時使用
   - ⚠️ 但不足以驗證資料庫連線

3. **手動驗證**
   - ❌ 容易遺漏步驟
   - ❌ 不適合自動化部署

**參考文件**:
- docs/deployment/cloud-run-deployment-guide.md (行 640-725)

---

### 9. 日誌和監控策略

#### 決策：使用 Cloud Logging + Cloud Monitoring

**選擇原因**:
- **內建整合**: Cloud Run 自動發送日誌到 Cloud Logging
- **無需設定**: 不需要額外的 logging agent
- **強大查詢**: 支援複雜的日誌查詢和過濾
- **告警功能**: Cloud Monitoring 可設定告警

**後端日誌設定**:

使用 Python logging 模組：
```python
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)
```

結構化日誌（可選）：
```python
import json

def log_structured(message, **kwargs):
    log_entry = {
        "message": message,
        "severity": kwargs.get("severity", "INFO"),
        **kwargs
    }
    print(json.dumps(log_entry))
```

**前端日誌**:
Nginx access logs 自動發送到 Cloud Logging

**日誌查詢範例**:

```bash
# 查看最近的錯誤
gcloud logging read \
  "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit 50 \
  --format json

# 查看特定服務的日誌
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=backend" \
  --limit 100

# 查看慢查詢（假設有記錄）
gcloud logging read \
  "resource.type=cloud_run_revision AND textPayload=~'slow query'" \
  --limit 20
```

**監控指標**:

Cloud Run 自動收集：
- Request count
- Request latency (p50, p95, p99)
- Container CPU utilization
- Container memory utilization
- Container instance count

**替代方案及拒絕原因**:

1. **使用第三方 logging 服務（如 Datadog）**
   - ❌ 額外成本
   - ❌ 需要額外設定

2. **使用檔案系統日誌**
   - ❌ Cloud Run 是無狀態的，檔案會遺失
   - ❌ 不適合容器環境

3. **不記錄日誌**
   - ❌ 無法除錯問題
   - ❌ 無法追蹤使用情況

**參考文件**:
- docs/deployment/cloud-run-deployment-guide.md (行 1062-1095)

---

### 10. 部署腳本自動化

#### 決策：建立可重用的 Shell 腳本

**選擇原因**:
- **可重複性**: 每次部署步驟一致
- **減少錯誤**: 避免手動輸入錯誤
- **文件化**: 腳本本身就是文件
- **易於維護**: 參數化設定，易於調整

**腳本結構**:

1. **`scripts/deploy/deploy-backend.sh`**:
```bash
#!/bin/bash
set -euo pipefail

# 設定
PROJECT_ID="three-birds-on-mountain"
REGION="asia-east1"
SERVICE_NAME="road-safety-backend"
CLOUD_SQL_INSTANCE="tpml-seat-tracker-db"

# 建置
echo "建置 Docker 映像..."
gcloud builds submit backend/ \
  --tag "$REGION-docker.pkg.dev/$PROJECT_ID/containers/$SERVICE_NAME:latest"

# 部署
echo "部署到 Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/containers/$SERVICE_NAME:latest" \
  --region="$REGION" \
  --platform=managed \
  --add-cloudsql-instances="$PROJECT_ID:$REGION:$CLOUD_SQL_INSTANCE" \
  --update-env-vars="DATABASE_URL=postgresql://..." \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --allow-unauthenticated

echo "部署完成！"
```

2. **`scripts/deploy/deploy-frontend.sh`**:
```bash
#!/bin/bash
set -euo pipefail

PROJECT_ID="three-birds-on-mountain"
REGION="asia-east1"
SERVICE_NAME="road-safety-frontend"

# 取得後端 URL
BACKEND_URL=$(gcloud run services describe road-safety-backend \
  --region="$REGION" --format="value(status.url)")

# 建置（注入環境變數）
echo "建置前端映像..."
gcloud builds submit frontend/ \
  --config frontend/cloudbuild.yaml \
  --substitutions="_API_URL=$BACKEND_URL,_MAPBOX_TOKEN=$MAPBOX_TOKEN"

# 部署
echo "部署前端..."
gcloud run deploy "$SERVICE_NAME" \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/containers/$SERVICE_NAME:latest" \
  --region="$REGION" \
  --platform=managed \
  --port=80 \
  --memory=256Mi \
  --allow-unauthenticated

echo "部署完成！"
```

3. **`scripts/deploy/run-migration.sh`**:
```bash
#!/bin/bash
set -euo pipefail

PROJECT_ID="three-birds-on-mountain"
REGION="asia-east1"
CLOUD_SQL_INSTANCE="tpml-seat-tracker-db"

# 啟動 Cloud SQL Proxy
echo "啟動 Cloud SQL Proxy..."
cloud-sql-proxy --port 5432 "$PROJECT_ID:$REGION:$CLOUD_SQL_INSTANCE" &
PROXY_PID=$!

# 等待 proxy 啟動
sleep 3

# 執行 migration
echo "執行 database migration..."
cd backend
export DATABASE_URL="postgresql+psycopg2://..."
alembic upgrade head

# 關閉 proxy
kill $PROXY_PID

echo "Migration 完成！"
```

**使用方式**:
```bash
# 完整部署流程
./scripts/deploy/run-migration.sh        # 1. 執行 migration
./scripts/deploy/deploy-backend.sh       # 2. 部署後端
./scripts/deploy/deploy-frontend.sh      # 3. 部署前端
./scripts/deploy/verify-deployment.sh    # 4. 驗證部署
```

**替代方案及拒絕原因**:

1. **手動執行 gcloud 指令**
   - ❌ 容易出錯
   - ❌ 不可重現

2. **使用 Makefile**
   - ✅ 也是可行的選擇
   - ⚠️ Shell 腳本更簡單直觀

3. **使用 Terraform**
   - ❌ 對於簡單部署過於複雜
   - ❌ 學習曲線較陡

**參考文件**:
- docs/deployment/DEPLOYMENT.md (全文)

---

## 技術堆疊總結

### 後端
- **語言**: Python 3.12
- **框架**: FastAPI 0.104+
- **資料庫**: PostgreSQL 15 (Cloud SQL)
- **ORM**: SQLAlchemy 2.0
- **Migration**: Alembic 1.12
- **ASGI Server**: Uvicorn (2 workers)
- **容器**: Docker (multi-stage build)
- **部署平台**: Google Cloud Run

### 前端
- **語言**: TypeScript 5.9
- **框架**: React 19.1
- **建置工具**: Vite 7.1
- **狀態管理**: Redux Toolkit 2.10
- **地圖**: Mapbox GL 3.16
- **Web Server**: Nginx (alpine)
- **容器**: Docker (multi-stage build)
- **部署平台**: Google Cloud Run

### 基礎設施
- **雲端平台**: Google Cloud Platform
- **容器註冊**: Artifact Registry
- **建置服務**: Cloud Build
- **資料庫**: Cloud SQL (共用實例)
- **密碼管理**: Secret Manager
- **日誌**: Cloud Logging
- **監控**: Cloud Monitoring
- **專案**: three-birds-on-mountain
- **區域**: asia-east1

---

## 部署流程總覽

```
┌─────────────────────────────────────────────────────────────┐
│                     部署流程圖                                │
└─────────────────────────────────────────────────────────────┘

1. 前置準備
   ├── 設定 gcloud project 和 region
   ├── 啟用必要的 GCP API
   ├── 建立 Artifact Registry (如未建立)
   └── 確認 Cloud SQL 實例可用

2. 資料庫準備
   ├── 安裝 Cloud SQL Proxy
   ├── 啟動 Proxy 連線
   ├── 執行 Alembic migration
   └── 驗證資料表建立

3. 後端部署
   ├── 更新 Dockerfile (Cloud Run 最佳實踐)
   ├── 更新 src/core/config.py (環境變數支援)
   ├── 更新 src/db/session.py (Unix socket 支援)
   ├── 建置 Docker 映像 (Cloud Build)
   ├── 部署到 Cloud Run
   └── 驗證 health endpoint

4. 前端部署
   ├── 建立 Dockerfile
   ├── 建立 cloudbuild.yaml
   ├── 建立 nginx.conf
   ├── 建置 Docker 映像 (注入 API_URL)
   ├── 部署到 Cloud Run
   └── 驗證前端載入

5. CORS 設定
   ├── 取得前端 URL
   ├── 更新後端 CORS_ORIGINS
   └── 驗證前端可呼叫後端

6. 驗證測試
   ├── Health check
   ├── API endpoints 測試
   ├── 前端功能測試
   └── 整合測試

7. 監控設定
   ├── 查看 Cloud Logging
   ├── 檢查 Cloud Monitoring 指標
   └── （可選）設定告警
```

---

## 風險和緩解策略

### 風險 1: 資料庫連線失敗
**可能原因**:
- Cloud SQL 實例未啟動
- DATABASE_URL 格式錯誤
- 未設定 `--add-cloudsql-instances`

**緩解策略**:
- 部署前驗證 Cloud SQL 狀態
- 使用腳本自動組合 DATABASE_URL
- 部署腳本包含完整參數檢查

### 風險 2: 前端無法呼叫後端（CORS 錯誤）
**可能原因**:
- CORS_ORIGINS 未設定
- 前端 URL 與設定不符

**緩解策略**:
- 部署後立即更新 CORS 設定
- 驗證腳本包含 CORS 測試

### 風險 3: Migration 失敗
**可能原因**:
- 資料庫權限不足
- Schema 衝突

**緩解策略**:
- Migration 前備份資料庫
- 使用 `alembic current` 檢查當前版本
- 測試環境先執行驗證

### 風險 4: 冷啟動時間過長
**可能原因**:
- Docker 映像過大
- 資料庫連線建立緩慢

**緩解策略**:
- 使用 multi-stage build 減少映像大小
- 生產環境設定 min-instances=1
- 優化資料庫連線池設定

### 風險 5: 部署成本超支
**可能原因**:
- 未設定 max-instances
- 資源配置過高

**緩解策略**:
- 設定合理的 max-instances
- 使用 min-instances=0（開發環境）
- 定期檢查 Cloud Billing

---

## 下一步

研究完成後，將進入 Phase 1 設計階段，產生：

1. **data-model.md**: 部署配置資料模型（環境變數、服務設定等）
2. **contracts/**: 部署操作和驗證的 API 規格
3. **quickstart.md**: 快速部署指南

---

**研究完成日期**: 2025-11-08
**研究者**: Claude Code
**版本**: 1.0
