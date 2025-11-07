"""Download the weekly MOI A1 accident dataset (CSV) and overwrite local copies."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO, StringIO, TextIOWrapper
from pathlib import Path
from typing import Any

import httpx
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_batch

DATA_ROOT = Path(__file__).resolve().parent
DEFAULT_SOURCE_URL = "https://data.moi.gov.tw/MoiOD/System/DownloadFile.aspx?DATA=402E554F-10E7-42C9-BAAF-DF7C431E3F18"
DEFAULT_DATASET_SUBDIR = "moi_a1"
CSV_FILENAME = "records.csv"
RAW_FILENAME = "source.csv"
METADATA_FILENAME = "metadata.json"
DEFAULT_TABLE_NAME = "raw_moi_a1"

EXPECTED_COLUMNS = [
    "發生年度",
    "發生月份",
    "發生日期",
    "發生時間",
    "事故類別名稱",
    "處理單位名稱警局層",
    "發生地點",
    "天候名稱",
    "光線名稱",
    "道路類別-第1當事者-名稱",
    "速限-第1當事者",
    "道路型態大類別名稱",
    "道路型態子類別名稱",
    "事故位置大類別名稱",
    "事故位置子類別名稱",
    "路面狀況-路面鋪裝名稱",
    "路面狀況-路面狀態名稱",
    "路面狀況-路面缺陷名稱",
    "道路障礙-障礙物名稱",
    "道路障礙-視距品質名稱",
    "道路障礙-視距名稱",
    "號誌-號誌種類名稱",
    "號誌-號誌動作名稱",
    "車道劃分設施-分向設施大類別名稱",
    "車道劃分設施-分向設施子類別名稱",
    "車道劃分設施-分道設施-快車道或一般車道間名稱",
    "車道劃分設施-分道設施-快慢車道間名稱",
    "車道劃分設施-分道設施-路面邊線名稱",
    "事故類型及型態大類別名稱",
    "事故類型及型態子類別名稱",
    "肇因研判大類別名稱-主要",
    "肇因研判子類別名稱-主要",
    "死亡受傷人數",
    "當事者順位",
    "當事者區分-類別-大類別名稱-車種",
    "當事者區分-類別-子類別名稱-車種",
    "當事者屬-性-別名稱",
    "當事者事故發生時年齡",
    "保護裝備名稱",
    "行動電話或電腦或其他相類功能裝置名稱",
    "當事者行動狀態大類別名稱",
    "當事者行動狀態子類別名稱",
    "車輛撞擊部位大類別名稱-最初",
    "車輛撞擊部位子類別名稱-最初",
    "車輛撞擊部位大類別名稱-其他",
    "車輛撞擊部位子類別名稱-其他",
    "肇因研判大類別名稱-個別",
    "肇因研判子類別名稱-個別",
    "肇事逃逸類別名稱-是否肇逃",
    "經度",
    "緯度",
]


@dataclass(slots=True)
class CollectorConfig:
    source_url: str = DEFAULT_SOURCE_URL
    dataset_subdir: str = DEFAULT_DATASET_SUBDIR
    output_root: Path = DATA_ROOT
    timeout: float = 60.0
    database_url: str | None = os.environ.get("DATABASE_URL")
    table_name: str = DEFAULT_TABLE_NAME

    def __post_init__(self) -> None:
        self.output_root = self.output_root.expanduser().resolve()
        self.source_url = self.source_url.strip()
        self.table_name = self.table_name.strip()

    @property
    def dataset_dir(self) -> Path:
        return self.output_root / self.dataset_subdir

    @property
    def csv_path(self) -> Path:
        return self.dataset_dir / CSV_FILENAME

    @property
    def raw_path(self) -> Path:
        return self.dataset_dir / RAW_FILENAME

    @property
    def metadata_path(self) -> Path:
        return self.dataset_dir / METADATA_FILENAME


class A1DatasetFetcher:
    def __init__(self, config: CollectorConfig):
        self.config = config
        self.config.dataset_dir.mkdir(parents=True, exist_ok=True)

    def download_csv_text(self) -> str:
        with httpx.Client(timeout=httpx.Timeout(self.config.timeout, connect=10.0)) as client:
            response = client.get(self.config.source_url)
            response.raise_for_status()
            payload = response.content

        if self._is_zip(payload):
            return self._extract_zip(payload)
        return payload.decode("utf-8-sig")

    def _is_zip(self, data: bytes) -> bool:
        return len(data) >= 4 and data[:4] == b"PK\x03\x04"

    def _extract_zip(self, data: bytes) -> str:
        with zipfile.ZipFile(BytesIO(data)) as zf:
            name = next((n for n in zf.namelist() if n.lower().endswith(".csv")), zf.namelist()[0])
            with zf.open(name) as fp:
                wrapper = TextIOWrapper(fp, encoding="utf-8-sig")
                return wrapper.read()

    def save_files(self, csv_text: str) -> tuple[int, list[str]]:
        self.config.raw_path.write_text(csv_text, encoding="utf-8")

        reader = csv.reader(StringIO(csv_text))
        rows = list(reader)
        if not rows:
            return 0, []

        header = rows[0]
        with self.config.csv_path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerows(rows)

        return max(len(rows) - 1, 0), header

    def write_metadata(self, row_count: int, header: list[str]) -> None:
        metadata: dict[str, Any] = {
            "source_url": self.config.source_url,
            "record_count": row_count,
            "expected_columns": EXPECTED_COLUMNS,
            "actual_columns": header,
            "csv_path": str(self.config.csv_path),
            "raw_path": str(self.config.raw_path),
            "downloaded_at": datetime.now(timezone.utc).isoformat(),
        }
        self.config.metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    def load_into_database(self, header: list[str]) -> None:
        if not self.config.database_url:
            print("Skipping database load because DATABASE_URL is not set.")
            return

        rows = self._read_rows(header)
        if not rows:
            print("No rows available for database load.")
            return

        with psycopg2.connect(self.config.database_url) as conn:
            with conn.cursor() as cur:
                self._ensure_table(cur, header)
                cur.execute(sql.SQL("TRUNCATE TABLE {}").format(sql.Identifier(self.config.table_name)))
                insert_query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                    sql.Identifier(self.config.table_name),
                    sql.SQL(", ").join(sql.Identifier(col) for col in header),
                    sql.SQL(", ").join(sql.Placeholder() for _ in header),
                )
                execute_batch(cur, insert_query.as_string(conn), rows, page_size=1000)

        print(f"Loaded {len(rows)} rows into table {self.config.table_name}.")

    def _ensure_table(self, cur, header: list[str]) -> None:
        columns_sql = sql.SQL(", ").join(
            sql.SQL("{} TEXT").format(sql.Identifier(col)) for col in header
        )
        cur.execute(
            sql.SQL("CREATE TABLE IF NOT EXISTS {} ({})").format(
                sql.Identifier(self.config.table_name),
                columns_sql,
            )
        )

    def _read_rows(self, header: list[str]) -> list[list[str]]:
        rows: list[list[str]] = []
        with self.config.csv_path.open("r", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for line in reader:
                rows.append([line.get(col, "") for col in header])
        return rows

    def run(self) -> None:
        csv_text = self.download_csv_text()
        row_count, header = self.save_files(csv_text)
        self.write_metadata(row_count, header)
        self.load_into_database(header)

        if header and header != EXPECTED_COLUMNS:
            print("⚠️ CSV header differs from EXPECTED_COLUMNS; check metadata for details.")

        print(
            f"Fetched {row_count} rows from A1 dataset and saved to {self.config.csv_path} "
            f"(metadata: {self.config.metadata_path})."
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download the weekly MOI A1 accident dataset (CSV) and store it locally."
    )
    parser.add_argument("--source-url", type=str, default=DEFAULT_SOURCE_URL, help="資料集下載 URL")
    parser.add_argument(
        "--dataset-subdir", type=str, default=DEFAULT_DATASET_SUBDIR, help="輸出子資料夾（預設 data/moi_a1）"
    )
    parser.add_argument("--output-dir", type=Path, default=DATA_ROOT, help="輸出根目錄（預設 data/）")
    parser.add_argument("--timeout", type=float, default=60.0, help="HTTP 逾時秒數（預設 60 秒）")
    parser.add_argument(
        "--database-url",
        type=str,
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL 連線字串（例如 postgresql://user:pass@host:5432/dbname）",
    )
    parser.add_argument(
        "--table-name",
        type=str,
        default=DEFAULT_TABLE_NAME,
        help="儲存 A1 資料的資料表名稱（預設 raw_moi_a1）",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = CollectorConfig(
        source_url=args.source_url,
        dataset_subdir=args.dataset_subdir,
        output_root=args.output_dir,
        timeout=args.timeout,
        database_url=args.database_url,
        table_name=args.table_name,
    )
    fetcher = A1DatasetFetcher(config)
    try:
        fetcher.run()
    except httpx.HTTPError as exc:
        print(f"Download failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
