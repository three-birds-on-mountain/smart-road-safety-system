"""Accident 模型：事故記錄模型（A1/A2/A3）"""
from sqlalchemy import Column, String, DateTime, Numeric, Boolean, Integer, Enum as SQLEnum, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography
import uuid
from datetime import datetime

from src.db.session import Base
from src.models import SourceType, SeverityLevel


class Accident(Base):
    """事故記錄模型"""

    __tablename__ = "accidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type = Column(SQLEnum(SourceType), nullable=False)
    source_id = Column(String(100), nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    location_text = Column(String)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    severity_level = Column(SQLEnum(SeverityLevel), nullable=False)
    vehicle_type = Column(String(50))
    raw_data = Column(JSONB)
    geocoded = Column(Boolean, nullable=False, default=False)
    geocode_confidence = Column(Numeric(3, 2))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # 空間索引（GIST，用於地理查詢）
        Index("idx_accident_geom", "geom", postgresql_using="gist"),
        # 時間索引（B-tree，用於時間範圍篩選）
        Index("idx_accident_occurred_at", "occurred_at", postgresql_ops={"occurred_at": "DESC"}),
        # 複合索引（嚴重程度 + 時間，支援熱點分析）
        Index("idx_accident_severity_time", "severity_level", "occurred_at"),
        # 來源唯一性約束（防止重複匯入）
        UniqueConstraint("source_type", "source_id", name="idx_accident_source"),
    )

