"""Load a local MOI A3 CSV file into PostgreSQL with English column names."""

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
except ModuleNotFoundError as exc:  # pragma: no cover - runtime guard
    psycopg2 = None  # type: ignore[assignment]
    sql = None  # type: ignore[assignment]
    execute_batch = None  # type: ignore[assignment]
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None

from moi_schema import CHINESE_COLUMNS, normalize_column_name, translate_columns

DATA_ROOT = Path(__file__).resolve().parent
DATACLASS_KWARGS = {"slots": True} if sys.version_info >= (3, 10) else {}
DEFAULT_CSV_PATH = Path.home() / "moi_a3" / "A3_2025.csv"
DEFAULT_TABLE_NAME = "raw_moi_a3"
DEFAULT_ACCIDENT_LEVEL = "A3"
DEFAULT_BATCH_SIZE = 1000
EXPECTED_COLUMNS = CHINESE_COLUMNS
DB_EXTRA_COLUMNS = ["accident_level", "etl_dt"]


@dataclass(**DATACLASS_KWARGS)
class LoaderConfig:
    csv_path: Path | None = DEFAULT_CSV_PATH
    table_name: str = DEFAULT_TABLE_NAME
    accident_level: str = DEFAULT_ACCIDENT_LEVEL
    database_url: str | None = os.environ.get("DATABASE_URL")
    batch_size: int = DEFAULT_BATCH_SIZE
    truncate_before_load: bool = True
    encoding: str = "utf-8-sig"

    def __post_init__(self) -> None:
        if self.csv_path is not None:
            self.csv_path = self.csv_path.expanduser().resolve()
        self.table_name = self.table_name.strip() or DEFAULT_TABLE_NAME
        self.accident_level = self.accident_level.strip() or DEFAULT_ACCIDENT_LEVEL


class A3CSVDatasetLoader:
    def __init__(self, config: LoaderConfig):
        self.config = config

    def run(self) -> None:
        if not self.config.database_url:
            raise SystemExit("DATABASE_URL is not set. Provide it via env var or --database-url.")
        if IMPORT_ERROR is not None:
            raise SystemExit(
                "psycopg2 (or psycopg2-binary) is required to run this loader; install it and retry."
            ) from IMPORT_ERROR

        csv_path = self._resolve_csv_path()
        header, english_header = self._read_header(csv_path)
        if not header:
            raise SystemExit(f"{csv_path} appears to be empty.")
        if header != EXPECTED_COLUMNS:
            print("⚠️ CSV header differs from the expected MOI schema; proceeding with detected columns.")

        db_columns = english_header + DB_EXTRA_COLUMNS
        with psycopg2.connect(self.config.database_url) as conn:
            insert_sql = self._build_insert_sql(db_columns, conn)
            with conn.cursor() as cur:
                self._ensure_table(cur, db_columns)
                if self.config.truncate_before_load:
                    cur.execute(sql.SQL("TRUNCATE TABLE {}").format(sql.Identifier(self.config.table_name)))
            conn.commit()

            inserted = self._load_file(conn, csv_path, header, insert_sql)
            conn.commit()

        print(f"Loaded {inserted} rows from {csv_path} into table {self.config.table_name}.")

    def _resolve_csv_path(self) -> Path:
        if self.config.csv_path is None:
            raise SystemExit("No CSV path provided; specify --csv-path.")
        if not self.config.csv_path.exists():
            raise SystemExit(f"CSV file not found: {self.config.csv_path}")
        return self.config.csv_path

    def _read_header(self, path: Path) -> tuple[list[str], list[str]]:
        with path.open("r", encoding=self.config.encoding, newline="") as fh:
            reader = csv.reader(fh)
            try:
                raw_header = next(reader)
            except StopIteration:
                return [], []
        header = [normalize_column_name(col) for col in raw_header]
        english_header = translate_columns(header)
        return header, english_header

    def _ensure_table(self, cur, db_columns: Iterable[str]) -> None:
        column_defs = []
        for column in db_columns:
            if column == "etl_dt":
                column_defs.append(sql.SQL("{} TIMESTAMPTZ NOT NULL").format(sql.Identifier(column)))
            else:
                column_defs.append(sql.SQL("{} TEXT").format(sql.Identifier(column)))
        cur.execute(
            sql.SQL("CREATE TABLE IF NOT EXISTS {} ({})").format(
                sql.Identifier(self.config.table_name),
                sql.SQL(", ").join(column_defs),
            )
        )

    def _build_insert_sql(self, db_columns: list[str], conn) -> str:
        insert_query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
            sql.Identifier(self.config.table_name),
            sql.SQL(", ").join(sql.Identifier(col) for col in db_columns),
            sql.SQL(", ").join(sql.Placeholder() for _ in db_columns),
        )
        return insert_query.as_string(conn)

    def _load_file(self, conn, path: Path, header: list[str], insert_sql: str) -> int:
        rows_inserted = 0
        batch: list[list[str]] = []
        etl_timestamp = datetime.now(timezone.utc)

        with path.open("r", encoding=self.config.encoding, newline="") as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None:
                return 0
            reader.fieldnames = [normalize_column_name(col or "") for col in reader.fieldnames]

            with conn.cursor() as cur:
                for record in reader:
                    row = [record.get(col, "") or "" for col in header]
                    row.append(self.config.accident_level)
                    row.append(etl_timestamp)
                    batch.append(row)
                    if len(batch) >= self.config.batch_size:
                        execute_batch(cur, insert_sql, batch, page_size=self.config.batch_size)
                        rows_inserted += len(batch)
                        batch.clear()
                if batch:
                    execute_batch(cur, insert_sql, batch, page_size=self.config.batch_size)
                    rows_inserted += len(batch)
        return rows_inserted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load a stored MOI A3 CSV into PostgreSQL.")
    parser.add_argument(
        "--csv-path",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help="Path to the A3 CSV file (default: ~/moi_a3/A3_2025.csv).",
    )
    parser.add_argument(
        "--table-name",
        type=str,
        default=DEFAULT_TABLE_NAME,
        help="Destination PostgreSQL table name (default: raw_moi_a3).",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL connection string, e.g. postgresql://user:pass@host:5432/dbname.",
    )
    parser.add_argument(
        "--accident-level",
        type=str,
        default=DEFAULT_ACCIDENT_LEVEL,
        help="Value to store in the accident_level column (default: A3).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Rows per INSERT batch (default: 1000).",
    )
    parser.add_argument(
        "--encoding",
        type=str,
        default="utf-8-sig",
        help="CSV text encoding (default: utf-8-sig).",
    )
    parser.add_argument(
        "--no-truncate",
        action="store_true",
        help="Append rows instead of truncating the destination table first.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = LoaderConfig(
        csv_path=args.csv_path,
        table_name=args.table_name,
        accident_level=args.accident_level,
        database_url=args.database_url,
        batch_size=args.batch_size,
        truncate_before_load=not args.no_truncate,
        encoding=args.encoding,
    )
    loader = A3CSVDatasetLoader(config)
    loader.run()


if __name__ == "__main__":
    main()
