# Environment Variables

## 環境變數清單

| Variable | Location | Required | Description | Example |
|----------|----------|----------|-------------|---------|
| `DATABASE_URL` | backend / docker-compose | ✅ | PostgreSQL + PostGIS 連線字串 | `postgresql://postgres:postgres@localhost:5432/road_safety_db` |
| `GOOGLE_MAPS_API_KEY` | backend | ✅ | Geocoding/Reverse Geocoding API Key | `AIza...` |
| `ADMIN_JWT_SECRET` | backend | ✅ | Admin JWT HS256 簽章密鑰 | `change-me-in-prod` |
| `CORS_ORIGINS` | backend | ❌ | CORS 允許的來源（逗號分隔），使用 `*` 允許所有來源 | `*` 或 `https://example.com,https://app.example.com` |
| `ENVIRONMENT` | backend | ❌ | 運行環境 `development` / `staging` / `production` | `development` |
| `LOG_LEVEL` | backend | ❌ | Python logging level | `INFO` |
| `VITE_API_BASE_URL` | frontend | ✅ | Backend API URL | `http://localhost:8000/api/v1` |
| `VITE_MAPBOX_ACCESS_TOKEN` | frontend | ✅ | Mapbox Access Token | `pk.eyJ1Ijo...` |
| `VITE_DISABLE_MOCK_PREVIEW` | frontend | ❌ | 控制 DEV 模式是否載入 mock 熱點 | `true` / `false` |
| `VITE_USE_MOCK_API` | frontend | ❌ | 強制走本地 mock API | `true` |
| `VITE_FALLBACK_TO_MOCK` | frontend | ❌ | API 失敗時是否回退 mock | `true` |

## 環境配置說明

### 本地開發環境

1. **後端** (`backend/.env`):
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/road_safety_db
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   ADMIN_JWT_SECRET=change-me
   CORS_ORIGINS=*
   LOG_LEVEL=INFO
   ENVIRONMENT=development
   ```

2. **前端** (`frontend/.env`):
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
   VITE_USE_MOCK_API=false
   VITE_FALLBACK_TO_MOCK=false
   VITE_DISABLE_MOCK_PREVIEW=false
   ```

### Docker Compose 環境

在 docker-compose 環境中，frontend 透過容器網路連接到 backend，因此 `VITE_API_BASE_URL` 應設為：
- 容器內部: `http://backend:8000/api/v1`
- 瀏覽器存取: `http://localhost:8000/api/v1`

可透過環境變數覆蓋：
```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1 docker-compose up
```

### 生產環境

⚠️ **安全注意事項**:
- 使用強密碼作為 `ADMIN_JWT_SECRET`
- 限制 `DATABASE_URL` 存取權限
- **限制 `CORS_ORIGINS` 為特定網域**，避免使用 `*`（例如：`https://example.com,https://app.example.com`）
- 透過安全的秘密管理機制儲存敏感資訊（AWS Secrets Manager、GCP Secret Manager、HashiCorp Vault）
- 設定 `ENVIRONMENT=production`
- 設定 `LOG_LEVEL=WARNING` 或 `ERROR`

## Files

- `backend/.env.example`
- `frontend/.env.example`
- `docs/environment-variables.md`（本文）

請勿將真實金鑰提交到版本控制，生產環境請使用安全的秘密管理機制（例如 AWS Secrets Manager、GCP Secret Manager、Vault）。***
