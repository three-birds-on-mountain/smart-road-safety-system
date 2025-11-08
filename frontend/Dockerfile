# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# 接收建置時的環境變數
ARG VITE_API_BASE_URL
ARG VITE_MAPBOX_ACCESS_TOKEN

# 設定環境變數（Vite 建置時會讀取）
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAPBOX_ACCESS_TOKEN=$VITE_MAPBOX_ACCESS_TOKEN

# ⚠️ 重要：確保不使用 mock 資料
ENV VITE_USE_MOCK_API=false
ENV VITE_FALLBACK_TO_MOCK=false
ENV VITE_DISABLE_MOCK_PREVIEW=true

# 複製 package 檔案
COPY package*.json ./

# 安裝依賴
RUN npm ci

# 複製原始碼
COPY . .

# 建置應用程式
RUN npm run build

# Production stage
FROM nginx:alpine

# 安裝 gettext 套件（提供 envsubst）
RUN apk add --no-cache gettext

# 複製建置產物
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製 nginx 設定範本
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template

# 設定預設 PORT
ENV PORT=8080

# 暴露 port（Cloud Run 會動態設定）
EXPOSE 8080

# 啟動 nginx（envsubst 會自動替換 $PORT）
CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
