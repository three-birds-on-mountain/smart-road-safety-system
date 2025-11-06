"""基礎 Enum 型別：SourceType, SeverityLevel"""
import enum


class SourceType(str, enum.Enum):
    """資料來源類型"""

    A1 = "A1"
    A2 = "A2"
    A3 = "A3"


class SeverityLevel(str, enum.Enum):
    """事故嚴重程度"""

    A1 = "A1"  # 死亡
    A2 = "A2"  # 受傷
    A3 = "A3"  # 財損

