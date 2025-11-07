"""Incremental collector for MOI A1 accident data (suitable for weekly schedules).

The API keeps appending rows to the same dataset. This script remembers the last processed
offset (stored in `data/moi_a1/metadata.json` by default), resumes from there on each run,
and appends only the newly available rows to `records.jsonl` or `records.csv`.
"""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

DATA_ROOT = Path(__file__).resolve().parent
BASE_API_URL = "https://od.moi.gov.tw/api/v1/rest/datastore/A01010000C-001309-001"
DEFAULT_LIMIT = 3000
DEFAULT_DATASET_SUBDIR = "moi_a1"
STATE_FILENAME = "metadata.json"
JSONL_FILENAME = "records.jsonl"
CSV_FILENAME = "records.csv"


@dataclass(slots=True)
class CollectorConfig:
    base_url: str = BASE_API_URL
    limit: int = DEFAULT_LIMIT
    dataset_subdir: str = DEFAULT_DATASET_SUBDIR
    output_root: Path = DATA_ROOT
    file_format: str = "csv"

    def __post_init__(self) -> None:
        self.output_root = self.output_root.expanduser().resolve()
        self.base_url = self.base_url.rstrip("/")
        self.file_format = self.file_format.lower()
        if self.file_format not in {"csv", "jsonl"}:
            raise ValueError("file_format must be either 'csv' or 'jsonl'")

    @property
    def dataset_dir(self) -> Path:
        return self.output_root / self.dataset_subdir

    @property
    def state_path(self) -> Path:
        return self.dataset_dir / STATE_FILENAME

    @property
    def records_path(self) -> Path:
        filename = CSV_FILENAME if self.file_format == "csv" else JSONL_FILENAME
        return self.dataset_dir / filename

    @property
    def dataset_key(self) -> str:
        return self.base_url


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_state(path: Path, dataset_key: str) -> dict[str, Any]:
    if path.exists():
        state = json.loads(path.read_text(encoding="utf-8"))
    else:
        state = {}

    stored_key = state.get("dataset_key") or state.get("resource_id") or dataset_key
    return {
        "dataset_key": stored_key,
        "last_offset": state.get("last_offset", 0),
        "last_total": state.get("last_total", 0),
        "stored_records": state.get("stored_records", 0),
        "last_run_at": state.get("last_run_at"),
        "last_checked_at": state.get("last_checked_at"),
    }


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def is_header_row(record: dict[str, Any]) -> bool:
    accymd = record.get("ACCYMD", "")
    place = record.get("PLACE", "")
    cartype = record.get("CARTYPE", "")
    return accymd.startswith("發生時間") and place.startswith("發生地點") and cartype.startswith("車種")


class MoiDatasetCollector:
    def __init__(self, config: CollectorConfig):
        self.config = config
        self.config.dataset_dir.mkdir(parents=True, exist_ok=True)
        self.state = load_state(self.config.state_path, self.config.dataset_key)
        self.field_ids: list[str] | None = None

    def fetch_batch(
        self, client: httpx.Client, offset: int, limit: int
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]] | None]:
        params = {"limit": limit, "offset": offset}
        resp = client.get(self.config.base_url, params=params)
        resp.raise_for_status()
        payload = resp.json()
        result = payload.get("result", {})
        return list(result.get("records", [])), result.get("fields")

    def append_records(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        if self.config.file_format == "jsonl":
            return self._append_jsonl(rows)
        return self._append_csv(rows)

    def _append_jsonl(self, rows: list[dict[str, Any]]) -> int:
        with self.config.records_path.open("a", encoding="utf-8") as fh:
            for row in rows:
                json.dump(row, fh, ensure_ascii=False)
                fh.write("\n")
        return len(rows)

    def _append_csv(self, rows: list[dict[str, Any]]) -> int:
        path = self.config.records_path
        file_exists = path.exists() and path.stat().st_size > 0

        fieldnames = self.field_ids
        if not fieldnames:
            unique: list[str] = []
            seen: set[str] = set()
            for rec in rows:
                for key in rec.keys():
                    if key not in seen:
                        seen.add(key)
                        unique.append(key)
            fieldnames = unique

        with path.open("a", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
            if not file_exists:
                writer.writeheader()
            writer.writerows(rows)
        return len(rows)

    def run(self, reset_offset: bool = False, dry_run: bool = False) -> None:
        start_offset = 0 if reset_offset else int(self.state["last_offset"])
        offset = start_offset
        total_rows = 0
        persisted = 0
        filtered_total = 0
        dry_preview: list[str] = []

        with httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            while True:
                batch, fields = self.fetch_batch(client, offset=offset, limit=self.config.limit)
                if fields and not self.field_ids:
                    self.field_ids = [f["id"] for f in fields if isinstance(f, dict) and "id" in f]

                if not batch:
                    break

                filtered = [record for record in batch if not is_header_row(record)]
                filtered_total += len(filtered)

                if dry_run:
                    dry_preview.extend(record.get("ACCYMD", "N/A") for record in filtered[:3])
                else:
                    persisted += self.append_records(filtered)

                batch_size = len(batch)
                total_rows += batch_size
                offset += batch_size

                if batch_size < self.config.limit:
                    break

        if total_rows == 0:
            self._save_state(
                {
                    **self.state,
                    "dataset_key": self.config.dataset_key,
                    "last_checked_at": utc_now(),
                }
            )
            print(f"No new rows. Stored offset remains {start_offset}.")
            return

        if dry_run:
            preview = ", ".join(dry_preview) if dry_preview else "（無可預覽資料）"
            print(
                f"Dry run: detected {filtered_total} new rows starting from offset {start_offset}. "
                f"Sample ACCYMD values: {preview}"
            )
            self._save_state(
                {
                    **self.state,
                    "dataset_key": self.config.dataset_key,
                    "last_checked_at": utc_now(),
                }
            )
            return

        new_offset = start_offset + total_rows
        next_state = {
            "dataset_key": self.config.dataset_key,
            "last_offset": new_offset,
            "last_total": new_offset,
            "stored_records": self.state["stored_records"] + persisted,
            "last_run_at": utc_now(),
            "last_checked_at": utc_now(),
        }
        self._save_state(next_state)

        print(
            f"Completed ingestion. Processed {total_rows} API rows and wrote "
            f"{persisted} records to {self.config.records_path}."
        )

    def _save_state(self, new_state: dict[str, Any]) -> None:
        self.state = new_state
        save_state(self.config.state_path, self.state)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Incrementally download MOI A1 accident data with offset tracking.",
    )
    parser.add_argument("--base-url", type=str, default=BASE_API_URL, help="完整 API URL")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="每次拉取的筆數")
    parser.add_argument(
        "--dataset-subdir",
        type=str,
        default=DEFAULT_DATASET_SUBDIR,
        help="資料輸出子資料夾（預設 data/moi_a1）",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DATA_ROOT,
        help="資料輸出根目錄（預設 data/）",
    )
    parser.add_argument(
        "--format",
        choices=["csv", "jsonl"],
        default="csv",
        help="儲存格式（預設 csv）",
    )
    parser.add_argument("--reset-offset", action="store_true", help="忽略 metadata，從頭再抓一次")
    parser.add_argument("--dry-run", action="store_true", help="只檢查是否有新資料，不寫檔")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = CollectorConfig(
        base_url=args.base_url,
        limit=args.limit,
        dataset_subdir=args.dataset_subdir,
        output_root=args.output_dir,
        file_format=args.format,
    )
    collector = MoiDatasetCollector(config)
    collector.run(reset_offset=args.reset_offset, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
