"""Shared schema utilities for MOI A1/A2/A3 accident CSV datasets."""

from __future__ import annotations

from typing import Iterable, List, Tuple

RAW_TO_ENGLISH_COLUMNS: List[Tuple[str, str]] = [
    ("發生年度", "occurrence_year"),
    ("發生月份", "occurrence_month"),
    ("發生日期", "occurrence_date"),
    ("發生時間", "occurrence_time"),
    ("事故類別名稱", "accident_category_name"),
    ("處理單位名稱警局層", "handling_unit_name"),
    ("發生地點", "location"),
    ("天候名稱", "weather_name"),
    ("光線名稱", "lighting_name"),
    ("道路類別-第1當事者-名稱", "road_category_primary"),
    ("速限-第1當事者", "speed_limit_primary"),
    ("道路型態大類別名稱", "road_type_major_name"),
    ("道路型態子類別名稱", "road_type_minor_name"),
    ("事故位置大類別名稱", "accident_location_major_name"),
    ("事故位置子類別名稱", "accident_location_minor_name"),
    ("路面狀況-路面鋪裝名稱", "pavement_type"),
    ("路面狀況-路面狀態名稱", "pavement_condition"),
    ("路面狀況-路面缺陷名稱", "pavement_defect"),
    ("道路障礙-障礙物名稱", "road_obstacle"),
    ("道路障礙-視距品質名稱", "sight_quality"),
    ("道路障礙-視距名稱", "sight_distance"),
    ("號誌-號誌種類名稱", "signal_type"),
    ("號誌-號誌動作名稱", "signal_action"),
    ("車道劃分設施-分向設施大類別名稱", "lane_direction_major"),
    ("車道劃分設施-分向設施子類別名稱", "lane_direction_minor"),
    ("車道劃分設施-分道設施-快車道或一般車道間名稱", "lane_between_express_general"),
    ("車道劃分設施-分道設施-快慢車道間名稱", "lane_between_fast_slow"),
    ("車道劃分設施-分道設施-路面邊線名稱", "lane_edge_line"),
    ("事故類型及型態大類別名稱", "accident_type_major_name"),
    ("事故類型及型態子類別名稱", "accident_type_minor_name"),
    ("肇因研判大類別名稱-主要", "cause_major_primary"),
    ("肇因研判子類別名稱-主要", "cause_minor_primary"),
    ("死亡受傷人數", "casualties"),
    ("當事者順位", "party_sequence"),
    ("當事者區分-類別-大類別名稱-車種", "party_vehicle_category_major"),
    ("當事者區分-類別-子類別名稱-車種", "party_vehicle_category_minor"),
    ("當事者屬-性-別名稱", "party_gender"),
    ("當事者事故發生時年齡", "party_age"),
    ("保護裝備名稱", "protective_equipment"),
    ("行動電話或電腦或其他相類功能裝置名稱", "device_usage"),
    ("當事者行動狀態大類別名稱", "party_motion_major"),
    ("當事者行動狀態子類別名稱", "party_motion_minor"),
    ("車輛撞擊部位大類別名稱-最初", "vehicle_impact_major_initial"),
    ("車輛撞擊部位子類別名稱-最初", "vehicle_impact_minor_initial"),
    ("車輛撞擊部位大類別名稱-其他", "vehicle_impact_major_other"),
    ("車輛撞擊部位子類別名稱-其他", "vehicle_impact_minor_other"),
    ("肇因研判大類別名稱-個別", "cause_major_individual"),
    ("肇因研判子類別名稱-個別", "cause_minor_individual"),
    ("肇事逃逸類別名稱-是否肇逃", "hit_and_run_flag"),
    ("經度", "longitude"),
    ("緯度", "latitude"),
]

CHINESE_COLUMNS: List[str] = [item[0] for item in RAW_TO_ENGLISH_COLUMNS]
ENGLISH_COLUMNS: List[str] = [item[1] for item in RAW_TO_ENGLISH_COLUMNS]
COLUMN_NAME_MAP = dict(RAW_TO_ENGLISH_COLUMNS)


def normalize_column_name(raw_name: str) -> str:
    """Trim whitespace/BOM characters from a header column."""
    return raw_name.replace("\ufeff", "").strip()


def translate_columns(columns: Iterable[str]) -> List[str]:
    """Translate a sequence of Chinese header names into English equivalents.

    Raises ValueError if any column is unknown so downstream callers can stop early.
    """

    translated: List[str] = []
    missing: List[str] = []

    for col in columns:
        normalized = normalize_column_name(col)
        english = COLUMN_NAME_MAP.get(normalized)
        if english is None:
            missing.append(normalized or col)
        else:
            translated.append(english)

    if missing:
        raise ValueError(f"Unknown MOI column(s): {', '.join(missing)}")
    return translated
