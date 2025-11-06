"""Initial schema with triggers

Revision ID: 001_initial_schema
Revises: 
Create Date: 2025-11-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 啟用 PostGIS 擴充
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 建立 ENUM 型別（如果不存在）
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE source_type AS ENUM ('A1', 'A2', 'A3');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        
        DO $$ BEGIN
            CREATE TYPE severity_level AS ENUM ('A1', 'A2', 'A3');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # 建立 accidents 表
    op.create_table(
        'accidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source_type', postgresql.ENUM('A1', 'A2', 'A3', name='source_type', create_type=False), nullable=False),
        sa.Column('source_id', sa.String(100), nullable=False),
        sa.Column('occurred_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('location_text', sa.Text()),
        sa.Column('latitude', sa.Numeric(10, 7), nullable=False),
        sa.Column('longitude', sa.Numeric(10, 7), nullable=False),
        sa.Column('severity_level', postgresql.ENUM('A1', 'A2', 'A3', name='severity_level', create_type=False), nullable=False),
        sa.Column('vehicle_type', sa.String(50)),
        sa.Column('raw_data', postgresql.JSONB()),
        sa.Column('geocoded', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('geocode_confidence', sa.Numeric(3, 2)),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # 建立空間欄位（使用 PostGIS）
    op.execute("""
        ALTER TABLE accidents
        ADD COLUMN geom GEOGRAPHY(POINT, 4326);
    """)

    # 建立索引
    op.create_index('idx_accident_geom', 'accidents', ['geom'], postgresql_using='gist')
    op.create_index('idx_accident_occurred_at', 'accidents', ['occurred_at'], postgresql_ops={'occurred_at': 'DESC'})
    op.create_index('idx_accident_severity_time', 'accidents', ['severity_level', 'occurred_at'])
    op.create_unique_constraint('idx_accident_source', 'accidents', ['source_type', 'source_id'])

    # 建立 hotspots 表
    op.create_table(
        'hotspots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('center_latitude', sa.Numeric(10, 7), nullable=False),
        sa.Column('center_longitude', sa.Numeric(10, 7), nullable=False),
        sa.Column('radius_meters', sa.Integer(), nullable=False),
        sa.Column('total_accidents', sa.Integer(), nullable=False),
        sa.Column('a1_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('a2_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('a3_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('earliest_accident_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('latest_accident_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('analysis_date', sa.Date(), nullable=False),
        sa.Column('analysis_period_start', sa.Date(), nullable=False),
        sa.Column('analysis_period_end', sa.Date(), nullable=False),
        sa.Column('accident_ids', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # 建立空間欄位
    op.execute("""
        ALTER TABLE hotspots
        ADD COLUMN geom GEOGRAPHY(POINT, 4326);
    """)

    # 建立索引
    op.create_index('idx_hotspot_geom', 'hotspots', ['geom'], postgresql_using='gist')
    op.create_index('idx_hotspot_analysis_date', 'hotspots', ['analysis_date'], postgresql_ops={'analysis_date': 'DESC'})
    op.create_index('idx_hotspot_accident_time', 'hotspots', ['earliest_accident_at', 'latest_accident_at'])
    op.execute("""
        CREATE INDEX idx_hotspot_active ON hotspots (analysis_date)
        WHERE total_accidents >= 5;
    """)

    # 建立 Trigger 函數：自動更新 geom 欄位
    # 處理 accidents 表的函數
    op.execute("""
        CREATE OR REPLACE FUNCTION update_accident_geom()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # 處理 hotspots 表的函數
    op.execute("""
        CREATE OR REPLACE FUNCTION update_hotspot_geom()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.geom := ST_SetSRID(ST_MakePoint(NEW.center_longitude, NEW.center_latitude), 4326)::geography;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 建立 Trigger：accidents 表自動更新 geom
    op.execute("""
        CREATE TRIGGER accidents_update_geom
        BEFORE INSERT OR UPDATE OF latitude, longitude ON accidents
        FOR EACH ROW
        EXECUTE FUNCTION update_accident_geom();
    """)

    # 建立 Trigger：hotspots 表自動更新 geom
    op.execute("""
        CREATE TRIGGER hotspots_update_geom
        BEFORE INSERT OR UPDATE OF center_latitude, center_longitude ON hotspots
        FOR EACH ROW
        EXECUTE FUNCTION update_hotspot_geom();
    """)

    # 建立 Trigger 函數：自動更新 updated_at 欄位
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at := NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 建立 Trigger：accidents 表自動更新 updated_at
    op.execute("""
        CREATE TRIGGER accidents_update_updated_at
        BEFORE UPDATE ON accidents
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)

    # 建立 Trigger：hotspots 表自動更新 updated_at
    op.execute("""
        CREATE TRIGGER hotspots_update_updated_at
        BEFORE UPDATE ON hotspots
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    """)


def downgrade() -> None:
    # 移除 Trigger
    op.execute("DROP TRIGGER IF EXISTS hotspots_update_updated_at ON hotspots;")
    op.execute("DROP TRIGGER IF EXISTS accidents_update_updated_at ON accidents;")
    op.execute("DROP TRIGGER IF EXISTS hotspots_update_geom ON hotspots;")
    op.execute("DROP TRIGGER IF EXISTS accidents_update_geom ON accidents;")

    # 移除 Trigger 函數
    op.execute("DROP FUNCTION IF EXISTS update_updated_at();")
    op.execute("DROP FUNCTION IF EXISTS update_hotspot_geom();")
    op.execute("DROP FUNCTION IF EXISTS update_accident_geom();")

    # 移除表
    op.drop_table('hotspots')
    op.drop_table('accidents')

    # 移除 ENUM 型別
    op.execute("DROP TYPE IF EXISTS severity_level;")
    op.execute("DROP TYPE IF EXISTS source_type;")

    # 移除 PostGIS 擴充
    op.execute("DROP EXTENSION IF EXISTS postgis;")

