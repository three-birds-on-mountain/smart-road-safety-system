# Feature Specification: Google Cloud Run 部署

**Feature Branch**: `002-gcloud-deployment`
**Created**: 2025-11-08
**Status**: Draft
**Input**: User description: "新的需求是我需要把前後端的專案透過 gcloud 部署到 google cloud run，可以參考之前的專案的部署文件 docs/deployment/ 的所有文件,我們會部署一個新的,但是 DB 會共用已經存在的 cloud SQL"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 部署後端服務到 Cloud Run (Priority: P1)

開發者需要將後端 FastAPI 應用程式部署到 Google Cloud Run，並連接到現有的 Cloud SQL 資料庫。

**Why this priority**: 這是核心功能，沒有後端服務就無法提供任何 API 功能給前端使用。

**Independent Test**: 可以透過存取 Cloud Run 服務的 health endpoint 並驗證資料庫連線狀態來獨立測試。具體做法是執行 `curl https://[SERVICE_URL]/api/v1/health` 並確認回應包含 `"database": "connected"`。

**Acceptance Scenarios**:

1. **Given** 開發者已設定好 GCP 專案和 Cloud SQL 實例, **When** 執行部署指令, **Then** 後端服務成功部署到 Cloud Run 並可透過公開 URL 存取
2. **Given** 後端服務已部署, **When** 呼叫 health endpoint, **Then** 系統回應 HTTP 200 且包含資料庫連線狀態
3. **Given** 後端服務已部署, **When** 呼叫任何 API endpoint (如 `/api/v1/libraries`), **Then** 系統能正確查詢資料庫並回傳資料
4. **Given** Cloud Run 服務處於閒置狀態超過設定時間, **When** 收到新請求, **Then** 服務自動啟動並在合理時間內回應 (冷啟動處理)

---

### User Story 2 - 部署前端服務到 Cloud Run (Priority: P2)

開發者需要將前端應用程式建置並部署到 Google Cloud Run，並正確設定後端 API URL 和地圖服務 token。

**Why this priority**: 前端依賴後端 API，必須在後端部署完成後才能正確設定和測試。

**Independent Test**: 可以透過瀏覽器存取前端 URL 並確認頁面載入、地圖顯示、API 呼叫都正常運作來獨立測試。

**Acceptance Scenarios**:

1. **Given** 後端服務已部署並取得 URL, **When** 執行前端建置和部署指令, **Then** 前端服務成功部署並可透過公開 URL 存取
2. **Given** 前端已部署, **When** 使用者開啟前端網址, **Then** 頁面正確載入且地圖元件正常顯示
3. **Given** 前端已部署, **When** 使用者操作需要呼叫後端 API 的功能, **Then** 前端成功呼叫後端並顯示資料
4. **Given** 前端已部署, **When** 檢查 CORS 設定, **Then** 後端正確允許來自前端 URL 的請求

---

### User Story 3 - 執行資料庫 Migration (Priority: P1)

開發者需要在部署後將資料庫 schema 初始化或更新到最新版本。

**Why this priority**: 資料庫 schema 必須正確建立，否則後端 API 無法正常運作。與 P1 後端部署同等重要。

**Independent Test**: 可以透過連線到 Cloud SQL 並查詢資料表列表來驗證 migration 是否成功執行。

**Acceptance Scenarios**:

1. **Given** Cloud SQL 實例已建立且可連線, **When** 透過 Cloud SQL Proxy 執行 Alembic migration, **Then** 所有必要的資料表都成功建立
2. **Given** 資料表已建立, **When** 查詢資料庫 schema, **Then** 資料表結構符合 Alembic migration 定義
3. **Given** 已有舊版本 schema, **When** 執行新的 migration, **Then** schema 成功升級且現有資料保持完整

---

### User Story 4 - 更新已部署的服務 (Priority: P2)

開發者修改程式碼後需要重新部署服務並確保不影響現有資料和服務可用性。

**Why this priority**: 這是日常維護的需求，在初次部署完成後才會需要。

**Independent Test**: 可以透過修改簡單的程式碼（如新增一個 API endpoint），重新部署，然後驗證新功能可用且舊功能不受影響來測試。

**Acceptance Scenarios**:

1. **Given** 服務已部署且正在運行, **When** 執行重新部署指令, **Then** 服務更新到新版本且中斷時間最小化
2. **Given** 需要更新環境變數 (如 CORS_ORIGINS), **When** 執行環境變數更新指令, **Then** 服務使用新的環境變數設定
3. **Given** 資料庫 schema 需要更新, **When** 執行新的 migration, **Then** schema 更新且服務繼續正常運作

---

### User Story 5 - 監控和除錯部署問題 (Priority: P3)

開發者需要查看服務日誌和狀態來診斷和解決部署或運行時問題。

**Why this priority**: 這是支援性功能，用於問題診斷，不是主要部署流程的一部分。

**Independent Test**: 可以故意引入一個錯誤（如錯誤的資料庫密碼），部署後透過查看日誌來定位問題。

**Acceptance Scenarios**:

1. **Given** 服務已部署, **When** 執行查看日誌指令, **Then** 可以看到服務的運行日誌和錯誤訊息
2. **Given** 服務發生錯誤, **When** 查看 Cloud Run 服務狀態, **Then** 可以看到服務健康狀態和錯誤原因
3. **Given** 需要追蹤特定請求, **When** 查看帶有過濾條件的日誌, **Then** 可以找到相關的請求日誌

---

### Edge Cases

- 當 Cloud SQL 連線失敗時會如何？系統應在日誌中記錄清楚的錯誤訊息，並在 health endpoint 回應資料庫連線狀態
- 當建置 Docker 映像失敗時會如何？Cloud Build 應提供清楚的錯誤訊息指出失敗原因
- 當前端建置時缺少必要的環境變數（API URL 或 Mapbox token）會如何？建置應該失敗並提示缺少的變數
- 當部署的服務記憶體不足或 CPU 超載時會如何？Cloud Run 應自動擴展實例數或在日誌中記錄資源限制錯誤
- 當執行 migration 時資料庫已有資料會如何？Alembic 應正確處理既有資料，只執行未執行過的 migration
- 當多個開發者同時部署會如何？Cloud Run 會依序處理部署請求，新版本會逐步取代舊版本

## Requirements *(mandatory)*

### Functional Requirements

#### 後端部署

- **FR-001**: 系統必須能夠將後端 Docker 映像建置並推送到 Google Artifact Registry
- **FR-002**: 系統必須能夠將後端服務部署到 Google Cloud Run，並使用 Unix socket 方式連接到共用的 Cloud SQL 實例
- **FR-003**: 後端服務必須能夠透過公開 URL 存取（或根據需求設定為需要驗證）
- **FR-004**: 後端服務必須能夠正確設定環境變數，包括資料庫連線 URL、CORS origins、日誌等級等
- **FR-005**: 系統必須提供後端服務的健康檢查 endpoint，可驗證服務和資料庫連線狀態

#### 前端部署

- **FR-006**: 系統必須能夠在建置時注入前端所需的環境變數（後端 API URL、Mapbox token 等）
- **FR-007**: 系統必須能夠將前端 Docker 映像建置並推送到 Google Artifact Registry
- **FR-008**: 系統必須能夠將前端服務部署到 Google Cloud Run
- **FR-009**: 前端服務必須正確設定 nginx 以支援 SPA 路由和必要的安全標頭
- **FR-010**: 後端必須設定 CORS 允許來自前端 URL 的請求

#### 資料庫管理

- **FR-011**: 系統必須支援透過 Cloud SQL Proxy 從本地環境連接到 Cloud SQL 進行 migration
- **FR-012**: 系統必須能夠執行 Alembic migration 來建立或更新資料庫 schema
- **FR-013**: Migration 必須支援版本控制，可以查詢當前版本和歷史記錄
- **FR-014**: 系統必須能夠驗證 migration 執行結果（如檢查資料表是否正確建立）

#### 更新和維護

- **FR-015**: 系統必須支援重新部署服務而不需要刪除現有服務
- **FR-016**: 系統必須支援更新服務的環境變數而不需要重新建置 Docker 映像
- **FR-017**: 系統必須支援查看服務狀態和運行資訊
- **FR-018**: 系統必須支援查看服務日誌以進行除錯

#### 資源管理

- **FR-019**: 後端服務必須設定適當的資源限制（記憶體、CPU）
- **FR-020**: 後端服務必須設定自動擴展參數（最小/最大實例數）
- **FR-021**: 服務閒置時必須能夠縮減到最小實例數以節省成本

### Key Entities

- **Cloud Run Service (後端)**: 運行 FastAPI 應用程式的容器化服務，包含服務名稱、映像 URL、環境變數、資源限制等屬性
- **Cloud Run Service (前端)**: 運行前端 SPA 的容器化服務，透過 nginx 提供靜態檔案服務
- **Docker Image**: 儲存在 Artifact Registry 中的容器映像，包含應用程式程式碼和依賴
- **Cloud SQL Instance**: 共用的 PostgreSQL 資料庫實例，包含連線名稱、IP、資料庫名稱、使用者等資訊
- **Environment Variables**: 服務運行時所需的配置參數，如資料庫 URL、API endpoints、tokens 等
- **Deployment Configuration**: 部署所需的所有參數，包括 region、project ID、service name、image URL 等

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 開發者能在 10 分鐘內完成後端服務的初次部署（不含 Cloud SQL 建立時間）
- **SC-002**: 開發者能在 5 分鐘內完成前端服務的初次部署
- **SC-003**: 後端服務的 health endpoint 在 95% 的時間內於 2 秒內回應
- **SC-004**: 服務更新部署時，中斷時間不超過 10 秒（Cloud Run 逐步取代實例期間）
- **SC-005**: 資料庫 migration 執行成功率達 100%（在正確設定的情況下）
- **SC-006**: 開發者能在 3 分鐘內查詢到所需的服務日誌
- **SC-007**: 前端成功呼叫後端 API 且無 CORS 錯誤
- **SC-008**: 服務在閒置 15 分鐘後能自動縮減到 0 實例，在收到請求後 30 秒內恢復服務（冷啟動）
- **SC-009**: 部署文件清楚完整，開發者能按照步驟獨立完成部署而無需額外協助

## Assumptions

- 開發者已經擁有 Google Cloud Platform 帳號並建立好專案
- 開發者已安裝 gcloud CLI 並完成身份驗證
- Cloud SQL 實例已經存在且正在運行（如專案 `three-birds-on-mountain` 的 `tpml-seat-tracker-db`）
- 開發者有權限存取該 Cloud SQL 實例
- 後端程式碼使用 FastAPI 框架
- 前端程式碼是 SPA（Single Page Application）架構
- 資料庫使用 PostgreSQL 15
- 使用 Alembic 進行資料庫 migration 管理
- 部署區域為 asia-east1（或可由開發者指定）
- 使用 Unix socket 方式連接 Cloud SQL（透過 Cloud SQL Proxy sidecar）
- Docker 映像使用 Artifact Registry 儲存
- 服務預設允許未經驗證的存取（可根據需求調整）
- 前端需要 Mapbox token 作為建置時環境變數
- 遵循 docs/deployment/ 中既有專案的部署模式和最佳實踐

## Dependencies

- Google Cloud Platform 服務（Cloud Run, Cloud SQL, Artifact Registry, Cloud Build）
- 現有的 Cloud SQL 實例必須可用
- 本地開發環境需要 gcloud CLI
- 後端 Dockerfile 必須正確設定
- 前端 Dockerfile 和 cloudbuild.yaml 必須正確設定
- Alembic migration 腳本必須正確定義
- 後端程式碼必須支援透過 DATABASE_URL 環境變數設定資料庫連線
- 前端程式碼必須支援透過環境變數設定 API URL 和 Mapbox token
