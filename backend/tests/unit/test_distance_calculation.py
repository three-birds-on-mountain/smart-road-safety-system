"""Unit test for 距離計算邏輯"""
import pytest
import json
from decimal import Decimal
from datetime import datetime, timedelta, date
from uuid import uuid4

from src.services.hotspot_service import HotspotService, calculate_severity_score
from src.models.hotspot import Hotspot
from geoalchemy2 import WKTElement


def test_calculate_severity_score():
    """測試嚴重程度分數計算"""
    # 建立測試熱點
    hotspot = Hotspot(
        id=uuid4(),
        center_latitude=Decimal("25.0"),
        center_longitude=Decimal("121.0"),
        geom=WKTElement("POINT(121.0 25.0)", srid=4326),
        radius_meters=500,
        total_accidents=10,
        a1_count=2,  # 2 * 5 = 10
        a2_count=3,  # 3 * 3 = 9
        a3_count=5,  # 5 * 1 = 5
        earliest_accident_at=datetime.utcnow() - timedelta(days=30),
        latest_accident_at=datetime.utcnow() - timedelta(days=1),
        analysis_date=date.today(),
        analysis_period_start=date.today() - timedelta(days=365),
        analysis_period_end=date.today() - timedelta(days=1),
        accident_ids=json.dumps([]),
    )
    
    score = calculate_severity_score(hotspot)
    # 預期分數: 2*5 + 3*3 + 5*1 = 10 + 9 + 5 = 24
    assert score == 24.0


def test_calculate_severity_score_only_a1():
    """測試只有 A1 事故的分數"""
    hotspot = Hotspot(
        id=uuid4(),
        center_latitude=Decimal("25.0"),
        center_longitude=Decimal("121.0"),
        geom=WKTElement("POINT(121.0 25.0)", srid=4326),
        radius_meters=500,
        total_accidents=3,
        a1_count=3,
        a2_count=0,
        a3_count=0,
        earliest_accident_at=datetime.utcnow() - timedelta(days=30),
        latest_accident_at=datetime.utcnow() - timedelta(days=1),
        analysis_date=date.today(),
        analysis_period_start=date.today() - timedelta(days=365),
        analysis_period_end=date.today() - timedelta(days=1),
        accident_ids=json.dumps([]),
    )
    
    score = calculate_severity_score(hotspot)
    # 預期分數: 3 * 5 = 15
    assert score == 15.0


def test_calculate_severity_score_zero_accidents():
    """測試沒有事故的分數"""
    hotspot = Hotspot(
        id=uuid4(),
        center_latitude=Decimal("25.0"),
        center_longitude=Decimal("121.0"),
        geom=WKTElement("POINT(121.0 25.0)", srid=4326),
        radius_meters=500,
        total_accidents=0,
        a1_count=0,
        a2_count=0,
        a3_count=0,
        earliest_accident_at=datetime.utcnow() - timedelta(days=30),
        latest_accident_at=datetime.utcnow() - timedelta(days=1),
        analysis_date=date.today(),
        analysis_period_start=date.today() - timedelta(days=365),
        analysis_period_end=date.today() - timedelta(days=1),
        accident_ids=json.dumps([]),
    )
    
    score = calculate_severity_score(hotspot)
    assert score == 0.0

