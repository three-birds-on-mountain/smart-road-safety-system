"""Hotspot 模型：熱點模型"""
from sqlalchemy import Column, String, DateTime, Numeric, Integer, Date, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography
import uuid
from datetime import datetime

from src.db.session import Base


class Hotspot(Base):
    """事故熱點模型"""

    __tablename__ = "hotspots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    center_latitude = Column(Numeric(10, 7), nullable=False)
    center_longitude = Column(Numeric(10, 7), nullable=False)
    geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    radius_meters = Column(Integer, nullable=False)
    total_accidents = Column(Integer, nullable=False)
    a1_count = Column(Integer, nullable=False, default=0)
    a2_count = Column(Integer, nullable=False, default=0)
    a3_count = Column(Integer, nullable=False, default=0)
    earliest_accident_at = Column(DateTime(timezone=True), nullable=False)
    latest_accident_at = Column(DateTime(timezone=True), nullable=False)
    analysis_date = Column(Date, nullable=False)
    analysis_period_start = Column(Date, nullable=False)
    analysis_period_end = Column(Date, nullable=False)
    accident_ids = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # 空間索引（GIST，用於距離查詢）
        Index("idx_hotspot_geom", "geom", postgresql_using="gist"),
        # 時間索引（B-tree，用於分析版本管理）
        Index("idx_hotspot_analysis_date", "analysis_date", postgresql_ops={"analysis_date": "DESC"}),
        # 複合索引（支援時間範圍篩選）
        Index("idx_hotspot_accident_time", "earliest_accident_at", "latest_accident_at"),
        # 部分索引（只索引有效熱點）
        Index("idx_hotspot_active", "analysis_date", postgresql_where="total_accidents >= 5"),
    )

