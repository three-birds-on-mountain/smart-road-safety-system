"""資料庫連線設定：SQLAlchemy engine, session factory"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from typing import Generator

from src.core.config import get_settings

settings = get_settings()

# 建立資料庫引擎
engine = create_engine(
    settings.database_url,
    poolclass=NullPool,
    echo=False,  # 設定為 True 可看到 SQL 查詢
)

# 建立 Session 工廠
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 建立 Base 類別（用於定義模型）
Base = declarative_base()


def get_db() -> Generator:
    """取得資料庫連線（Dependency）"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

