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

# 暴露端口
EXPOSE 8000

# 啟動應用程式
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

