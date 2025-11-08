"""Load locally stored MOI A2 CSV files into a PostgreSQL table."""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import execute_batch
except ModuleNotFoundError as exc:  # pragma: no cover - handled at runtime
    psycopg2 = None  # type: ignore[assignment]
    sql = None  # type: ignore[assignment]
    execute_batch = None  # type: ignore[assignment]
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None

DATA_ROOT = Path(__file__).resolve().parent
DATACLASS_KWARGS = {"slots": True} if sys.version_info >= (3, 10) else {}
DEFAULT_INPUT_SUBDIR = "moi_a2"
DEFAULT_GLOB_PATTERN = "A2_*.csv"
DEFAULT_TABLE_NAME = "raw_moi_a2"
DEFAULT_ACCIDENT_LEVEL = "A2"
DEFAULT_BATCH_SIZE = 1000
DB_EXTRA_COLUMNS = ["source_id", "accident_level", "etl_dt"]

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


@dataclass(**DATACLASS_KWARGS)
class LoaderConfig:
    input_dir: Path = DATA_ROOT / DEFAULT_INPUT_SUBDIR
    glob_pattern: str = DEFAULT_GLOB_PATTERN
    table_name: str = DEFAULT_TABLE_NAME
    accident_level: str = DEFAULT_ACCIDENT_LEVEL
    database_url: str | None = os.environ.get("DATABASE_URL")
    batch_size: int = DEFAULT_BATCH_SIZE
    truncate_before_load: bool = True
    encoding: str = "utf-8-sig"

    def __post_init__(self) -> None:
        self.input_dir = self.input_dir.expanduser().resolve()
        self.glob_pattern = self.glob_pattern.strip() or DEFAULT_GLOB_PATTERN
        self.table_name = self.table_name.strip() or DEFAULT_TABLE_NAME
        self.accident_level = self.accident_level.strip() or DEFAULT_ACCIDENT_LEVEL


class A2DatasetLoader:
    def __init__(self, config: LoaderConfig):
        self.config = config

    def run(self) -> None:
        if not self.config.database_url:
            raise SystemExit(
                "DATABASE_URL is not set. Provide it via env var or --database-url."
            )

        csv_files = self._list_csv_files()
        if not csv_files:
            print(
                f"No CSV files found in {self.config.input_dir} "
                f"matching pattern '{self.config.glob_pattern}'."
            )
            return

        header = self._determine_header(csv_files)
        if not header:
            print("Could not determine CSV header (files appear to be empty).")
            return

        if header != EXPECTED_COLUMNS:
            print(
                "⚠️ CSV header differs from the expected MOI A2 schema; proceeding with detected columns."
            )

        db_columns = header + DB_EXTRA_COLUMNS
        with psycopg2.connect(self.config.database_url) as conn:
            insert_sql = self._build_insert_sql(db_columns, conn)
            with conn.cursor() as cur:
                self._ensure_table(cur, db_columns)
                if self.config.truncate_before_load:
                    cur.execute(
                        sql.SQL("TRUNCATE TABLE {}").format(
                            sql.Identifier(self.config.table_name)
                        )
                    )
            conn.commit()

            total_rows = 0
            etl_timestamp = datetime.now(timezone.utc)
            row_counter = 0
            for file_idx, path in enumerate(csv_files, 1):
                inserted, row_counter = self._load_single_file(
                    conn, path, header, insert_sql, etl_timestamp, row_counter
                )
                conn.commit()
                total_rows += inserted
                print(f"Loaded {inserted} rows from {path.name}.")

        print(
            f"Finished loading {total_rows} rows from {len(csv_files)} file(s) into "
            f"table {self.config.table_name}."
        )

    def _list_csv_files(self) -> list[Path]:
        return sorted(self.config.input_dir.glob(self.config.glob_pattern))

    def _determine_header(self, csv_files: Iterable[Path]) -> list[str]:
        for path in csv_files:
            header = self._read_header(path)
            if header:
                return header
        return []

    def _read_header(self, path: Path) -> list[str]:
        with path.open("r", encoding=self.config.encoding, newline="") as fh:
            reader = csv.reader(fh)
            try:
                raw_header = next(reader)
            except StopIteration:
                return []
        return [col.strip() for col in raw_header]

    def _ensure_table(self, cur, db_columns: Iterable[str]) -> None:
        column_defs = []
        for column in db_columns:
            if column == "source_id":
                column_defs.append(
                    sql.SQL("{} TEXT PRIMARY KEY").format(sql.Identifier(column))
                )
            elif column == "etl_dt":
                column_defs.append(
                    sql.SQL("{} TIMESTAMPTZ NOT NULL").format(sql.Identifier(column))
                )
            else:
                column_defs.append(sql.SQL("{} TEXT").format(sql.Identifier(column)))
        cur.execute(
            sql.SQL("CREATE TABLE IF NOT EXISTS {} ({})").format(
                sql.Identifier(self.config.table_name),
                sql.SQL(", ").join(column_defs),
            )
        )

    def _build_insert_sql(self, header: list[str], conn) -> str:
        insert_query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
            sql.Identifier(self.config.table_name),
            sql.SQL(", ").join(sql.Identifier(col) for col in header),
            sql.SQL(", ").join(sql.Placeholder() for _ in header),
        )
        return insert_query.as_string(conn)

    def _load_single_file(
        self,
        conn,
        path: Path,
        header: list[str],
        insert_sql: str,
        etl_timestamp: datetime,
        start_row_counter: int,
    ) -> tuple[int, int]:
        """Load a single CSV file and return (rows_inserted, next_row_counter)"""
        rows_inserted = 0
        batch: list[list[str]] = []
        etl_date_str = etl_timestamp.strftime("%Y%m%d%H%M%S%f")  # 加上微秒
        row_counter = start_row_counter

        with path.open("r", encoding=self.config.encoding, newline="") as fh:
            reader = csv.DictReader(fh)
            with conn.cursor() as cur:
                for record in reader:
                    row_counter += 1
                    row = [record.get(column) or "" for column in header]
                    source_id = (
                        f"{self.config.accident_level}-{etl_date_str}-{row_counter:08d}"
                    )
                    row.append(source_id)
                    row.append(self.config.accident_level)
                    row.append(etl_timestamp)
                    batch.append(row)
                    if len(batch) >= self.config.batch_size:
                        execute_batch(
                            cur, insert_sql, batch, page_size=self.config.batch_size
                        )
                        rows_inserted += len(batch)
                        batch.clear()
                if batch:
                    execute_batch(
                        cur, insert_sql, batch, page_size=self.config.batch_size
                    )
                    rows_inserted += len(batch)
        return rows_inserted, row_counter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load monthly MOI A2 CSV files stored under data/moi_a2 into PostgreSQL."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DATA_ROOT / DEFAULT_INPUT_SUBDIR,
        help="Directory containing A2 CSV files (default: data/moi_a2).",
    )
    parser.add_argument(
        "--glob-pattern",
        type=str,
        default=DEFAULT_GLOB_PATTERN,
        help="Glob pattern to select CSV files (default: A2_*.csv).",
    )
    parser.add_argument(
        "--table-name",
        type=str,
        default=DEFAULT_TABLE_NAME,
        help="Destination PostgreSQL table name (default: raw_moi_a2).",
    )
    parser.add_argument(
        "--accident-level",
        type=str,
        default=DEFAULT_ACCIDENT_LEVEL,
        help="Value to store in the accident_level column (default: A2).",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL connection string, e.g. postgresql://user:pass@host:5432/dbname.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Number of rows per INSERT batch (default: 1000).",
    )
    parser.add_argument(
        "--no-truncate",
        action="store_true",
        help="Append instead of truncating the destination table before loading.",
    )
    parser.add_argument(
        "--encoding",
        type=str,
        default="utf-8-sig",
        help="Text encoding for CSV files (default: utf-8-sig).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if IMPORT_ERROR is not None:
        raise SystemExit(
            "psycopg2 (or psycopg2-binary) is required to run this loader; install it and retry."
        ) from IMPORT_ERROR
    config = LoaderConfig(
        input_dir=args.input_dir,
        glob_pattern=args.glob_pattern,
        table_name=args.table_name,
        accident_level=args.accident_level,
        database_url=args.database_url,
        batch_size=args.batch_size,
        truncate_before_load=not args.no_truncate,
        encoding=args.encoding,
    )
    loader = A2DatasetLoader(config)
    loader.run()


if __name__ == "__main__":
    main()
