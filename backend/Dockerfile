FROM python:3.12-slim

WORKDIR /app

# 安裝 uv
RUN pip install uv

# 複製專案檔案
COPY pyproject.toml ./
COPY alembic.ini ./

# 安裝依賴
RUN uv pip install --system -e .

# 複製原始碼和遷移腳本
COPY src/ ./src/

# 暴露端口（Cloud Run 使用 PORT 環境變數）
EXPOSE 8080

# 啟動應用程式（使用 PORT 環境變數，預設 8080）
CMD uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8080}

