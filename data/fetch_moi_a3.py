"""Download (or reuse local) MOI A3 accident CSV files and load them into PostgreSQL."""

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
from typing import Any, Iterable

DATA_ROOT = Path(__file__).resolve().parent
if str(DATA_ROOT) not in sys.path:
    sys.path.insert(0, str(DATA_ROOT))

import httpx

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import execute_batch
except ModuleNotFoundError as exc:  # pragma: no cover - runtime guard
    psycopg2 = None  # type: ignore[assignment]
    sql = None  # type: ignore[assignment]
    execute_batch = None  # type: ignore[assignment]
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None

from moi_schema import CHINESE_COLUMNS_A3, normalize_column_name, translate_columns

DEFAULT_SOURCE_URL = "https://data.moi.gov.tw/MoiOD/System/DownloadFile.aspx?DATA=6EC4380A-0F8A-4D68-809B-2218930F08FB"
DEFAULT_DATASET_SUBDIR = "moi_a3"
CSV_FILENAME = "records.csv"
RAW_FILENAME = "source.csv"
METADATA_FILENAME = "metadata.json"
DEFAULT_TABLE_NAME = "raw_moi_a3"
DEFAULT_ACCIDENT_LEVEL = "A3"
DEFAULT_LOCAL_CSV = Path.home() / "moi_a3" / "A3_2025.csv"
DB_EXTRA_COLUMNS = ["source_id", "accident_level", "etl_dt"]
EXPECTED_COLUMNS = CHINESE_COLUMNS_A3


@dataclass
class CollectorConfig:
    source_url: str = DEFAULT_SOURCE_URL
    dataset_subdir: str = DEFAULT_DATASET_SUBDIR
    output_root: Path = DATA_ROOT
    timeout: float = 60.0
    database_url: str | None = os.environ.get("DATABASE_URL")
    table_name: str = DEFAULT_TABLE_NAME
    accident_level: str = DEFAULT_ACCIDENT_LEVEL
    local_csv_path: Path | None = None
    local_csv_requested: bool = False

    def __post_init__(self) -> None:
        self.output_root = self.output_root.expanduser().resolve()
        self.source_url = self.source_url.strip()
        self.table_name = self.table_name.strip()
        self.accident_level = self.accident_level.strip() or DEFAULT_ACCIDENT_LEVEL

        if self.local_csv_path is not None:
            self.local_csv_path = self.local_csv_path.expanduser().resolve()
        elif DEFAULT_LOCAL_CSV.exists():
            self.local_csv_path = DEFAULT_LOCAL_CSV

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


class A3DatasetFetcher:
    def __init__(self, config: CollectorConfig):
        self.config = config
        self.config.dataset_dir.mkdir(parents=True, exist_ok=True)

    def run(self) -> None:
        csv_text = self._obtain_csv_text()
        row_count, header = self.save_files(csv_text)
        english_header = translate_columns(header, dataset_type="A3")
        self.write_metadata(row_count, header, english_header)
        self.load_into_database(header, english_header)

        if header and header != EXPECTED_COLUMNS:
            print(
                "⚠️ CSV header differs from EXPECTED_COLUMNS; check metadata for details."
            )

        print(
            f"Fetched {row_count} rows from A3 dataset and saved to {self.config.csv_path} "
            f"(metadata: {self.config.metadata_path})."
        )

    def _obtain_csv_text(self) -> str:
        local_path = self.config.local_csv_path
        if local_path and local_path.exists():
            print(f"Using local CSV: {local_path}")
            return local_path.read_text(encoding="utf-8-sig")
        if local_path and self.config.local_csv_requested:
            raise SystemExit(f"Local CSV file not found: {local_path}")
        return self.download_csv_text()

    def download_csv_text(self) -> str:
        with httpx.Client(
            timeout=httpx.Timeout(self.config.timeout, connect=10.0)
        ) as client:
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
            name = next(
                (n for n in zf.namelist() if n.lower().endswith(".csv")),
                zf.namelist()[0],
            )
            with zf.open(name) as fp:
                wrapper = TextIOWrapper(fp, encoding="utf-8-sig")
                return wrapper.read()

    def save_files(self, csv_text: str) -> tuple[int, list[str]]:
        self.config.raw_path.write_text(csv_text, encoding="utf-8")

        reader = csv.reader(StringIO(csv_text))
        rows = list(reader)
        if not rows:
            return 0, []

        # A3 dataset has two header rows:
        # Row 0: Short field names (ACCYMD, PLACE, CARTYPE)
        # Row 1: Full Chinese field names (發生時間, 發生地點, 車種)
        # We use row 1 as the actual header and skip row 0
        if len(rows) >= 2 and rows[0][0] in ("ACCYMD", "accymd"):
            header = [normalize_column_name(col) for col in rows[1]]
            data_rows = rows[2:]  # Data starts from row 2
        else:
            # Fallback: use first row as header if format is different
            header = [normalize_column_name(col) for col in rows[0]]
            data_rows = rows[1:]

        with self.config.csv_path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow(header)
            writer.writerows(data_rows)

        return max(len(data_rows), 0), header

    def write_metadata(
        self, row_count: int, header: list[str], english_header: list[str]
    ) -> None:
        metadata: dict[str, Any] = {
            "source_url": self.config.source_url,
            "record_count": row_count,
            "expected_columns": EXPECTED_COLUMNS,
            "actual_columns": header,
            "english_columns": english_header,
            "csv_path": str(self.config.csv_path),
            "raw_path": str(self.config.raw_path),
            "local_csv_path": (
                str(self.config.local_csv_path) if self.config.local_csv_path else None
            ),
            "downloaded_at": datetime.now(timezone.utc).isoformat(),
            "accident_level": self.config.accident_level,
        }
        self.config.metadata_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def load_into_database(self, header: list[str], english_header: list[str]) -> None:
        if not self.config.database_url:
            print("Skipping database load because DATABASE_URL is not set.")
            return

        if IMPORT_ERROR is not None:
            raise SystemExit(
                "psycopg2 (or psycopg2-binary) is required to load data into PostgreSQL; install it and retry."
            ) from IMPORT_ERROR

        rows = self._read_rows(header)
        if not rows:
            print("No rows available for database load.")
            return

        db_columns = english_header + DB_EXTRA_COLUMNS
        with psycopg2.connect(self.config.database_url) as conn:
            with conn.cursor() as cur:
                self._ensure_table(cur, db_columns)
                cur.execute(
                    sql.SQL("TRUNCATE TABLE {}").format(
                        sql.Identifier(self.config.table_name)
                    )
                )
                insert_query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                    sql.Identifier(self.config.table_name),
                    sql.SQL(", ").join(sql.Identifier(col) for col in db_columns),
                    sql.SQL(", ").join(sql.Placeholder() for _ in db_columns),
                )
                execute_batch(cur, insert_query.as_string(conn), rows, page_size=1000)

        print(f"Loaded {len(rows)} rows into table {self.config.table_name}.")

    def _ensure_table(self, cur, db_columns: Iterable[str]) -> None:
        columns_sql = []
        for column in db_columns:
            if column == "source_id":
                columns_sql.append(sql.SQL("{} TEXT PRIMARY KEY").format(sql.Identifier(column)))
            elif column == "etl_dt":
                columns_sql.append(
                    sql.SQL("{} TIMESTAMPTZ NOT NULL").format(sql.Identifier(column))
                )
            else:
                columns_sql.append(sql.SQL("{} TEXT").format(sql.Identifier(column)))
        cur.execute(
            sql.SQL("CREATE TABLE IF NOT EXISTS {} ({})").format(
                sql.Identifier(self.config.table_name),
                sql.SQL(", ").join(columns_sql),
            )
        )

    def _read_rows(self, header: list[str]) -> list[list[Any]]:
        rows: list[list[Any]] = []
        etl_timestamp = datetime.now(timezone.utc)
        etl_date_str = etl_timestamp.strftime("%Y%m%d%H%M%S%f")  # 加上微秒避免衝突
        with self.config.csv_path.open("r", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            for idx, line in enumerate(reader, 1):
                record = [line.get(col, "") or "" for col in header]
                source_id = f"{self.config.accident_level}-{etl_date_str}-{idx:08d}"
                record.append(source_id)
                record.append(self.config.accident_level)
                record.append(etl_timestamp)
                rows.append(record)
        return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download the weekly MOI A3 accident dataset (CSV) and store it locally."
    )
    parser.add_argument(
        "--source-url", type=str, default=DEFAULT_SOURCE_URL, help="資料集下載 URL"
    )
    parser.add_argument(
        "--dataset-subdir",
        type=str,
        default=DEFAULT_DATASET_SUBDIR,
        help="輸出子資料夾（預設 data/moi_a3）",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=DATA_ROOT, help="輸出根目錄（預設 data/）"
    )
    parser.add_argument(
        "--timeout", type=float, default=60.0, help="HTTP 逾時秒數（預設 60 秒）"
    )
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
        help="儲存 A3 資料的資料表名稱（預設 raw_moi_a3）",
    )
    parser.add_argument(
        "--accident-level",
        type=str,
        default=DEFAULT_ACCIDENT_LEVEL,
        help="儲存到資料庫的事故等級欄位值（預設 A3）",
    )
    parser.add_argument(
        "--local-csv",
        type=Path,
        default=None,
        help="優先使用的本地 CSV 檔案路徑（例如 ~/moi_a3/A3_2025.csv）",
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
        accident_level=args.accident_level,
        local_csv_path=args.local_csv,
        local_csv_requested=bool(args.local_csv),
    )
    fetcher = A3DatasetFetcher(config)
    try:
        fetcher.run()
    except httpx.HTTPError as exc:
        print(f"Download failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
