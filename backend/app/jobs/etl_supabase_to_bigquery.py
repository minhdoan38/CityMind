"""
Supabase → BigQuery daily analytics ETL (ANLY-01 / D-01..D-03 / D-16).

Cloud Run Job entrypoint:
  python -m app.jobs.etl_supabase_to_bigquery

Privacy: allowlisted columns only — never access_tokens, evidence URIs, notes, or free-text.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Callable, Protocol

UTC = timezone.utc

# --- D-16 allowlists (ANLY-01) -------------------------------------------------

ANALYTICS_REPORT_COLUMNS: tuple[str, ...] = (
    "report_id",
    "created_at",
    "category",
    "severity",
    "priority",
    "current_status",
    "latitude",
    "longitude",
)

ANALYTICS_EVENT_COLUMNS: tuple[str, ...] = (
    "event_id",
    "report_id",
    "status",
    "created_at",
)

REPORTS_EXTRACT_SELECT = ",".join(ANALYTICS_REPORT_COLUMNS)
EVENTS_EXTRACT_SELECT = ",".join(ANALYTICS_EVENT_COLUMNS)

PIPELINE_REPORTS = "reports"
PIPELINE_EVENTS = "status_events"

logger = logging.getLogger("citymind.etl")


def extract_table_names() -> list[str]:
    """Tables the ETL may read — access_tokens intentionally absent (D-16)."""
    return ["reports", "status_events"]


# --- Pure aggregation helpers (mirror BigQuery views for unit tests) ------------


def _as_date(value: datetime | date | str) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.astimezone(UTC).date() if value.tzinfo else value.date()
    # ISO string
    text = str(value).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).date()


def _as_datetime(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    text = str(value).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _in_range(day: date, date_from: date, date_to: date) -> bool:
    return date_from <= day <= date_to


def compute_sla_closed(
    reports: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """One closed_at per report_id = MIN(resolved/rejected); open = report created_at."""
    closes: dict[str, datetime] = {}
    for event in events:
        status = (event.get("status") or "").lower()
        if status not in {"resolved", "rejected"}:
            continue
        report_id = event["report_id"]
        closed_at = _as_datetime(event["created_at"])
        prev = closes.get(report_id)
        if prev is None or closed_at < prev:
            closes[report_id] = closed_at

    by_id = {r["report_id"]: r for r in reports}
    rows: list[dict[str, Any]] = []
    for report_id, closed_at in closes.items():
        report = by_id.get(report_id)
        if not report:
            continue
        opened_at = _as_datetime(report["created_at"])
        days = (_as_date(closed_at) - _as_date(opened_at)).days
        rows.append(
            {
                "report_id": report_id,
                "opened_at": opened_at,
                "closed_at": closed_at,
                "days_to_close": days,
            }
        )
    return rows


def aggregate_volume_daily(
    reports: list[dict[str, Any]],
    *,
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    counts: Counter[date] = Counter()
    for report in reports:
        day = _as_date(report["created_at"])
        if _in_range(day, date_from, date_to):
            counts[day] += 1
    return [
        {"day": day, "report_count": counts[day]}
        for day in sorted(counts)
    ]


def aggregate_category_mix(
    reports: list[dict[str, Any]],
    *,
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    counts: Counter[str] = Counter()
    for report in reports:
        day = _as_date(report["created_at"])
        if not _in_range(day, date_from, date_to):
            continue
        category = report.get("category") or "unknown"
        counts[category] += 1
    return [
        {"category": category, "report_count": counts[category]}
        for category in sorted(counts, key=lambda c: (-counts[c], c))
    ]


def aggregate_hotspot_category(
    reports: list[dict[str, Any]],
    *,
    date_from: date,
    date_to: date,
    top_n: int = 10,
) -> list[dict[str, Any]]:
    mix = aggregate_category_mix(reports, date_from=date_from, date_to=date_to)
    return mix[:top_n]


# --- Watermark + ETL orchestration (injectable for unit tests) ------------------


class WatermarkStore(Protocol):
    def get(self, pipeline: str) -> datetime | None: ...

    def set(self, pipeline: str, watermark: datetime) -> None: ...


@dataclass
class ExtractBatch:
    reports: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    max_report_created_at: datetime | None = None
    max_event_created_at: datetime | None = None
    full_reload: bool = False


ExtractFn = Callable[..., ExtractBatch | Any]
LoadFn = Callable[..., bool]


def utc_day_start(now: datetime | None = None) -> datetime:
    """Exclusive upper bound for incremental sync (data through previous UTC day)."""
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    current = current.astimezone(UTC)
    return datetime(current.year, current.month, current.day, tzinfo=UTC)


def run_etl(
    *,
    extract: ExtractFn,
    load: LoadFn,
    watermarks: WatermarkStore,
    full_reload: bool = False,
    dry_run: bool = False,
    sync_until: datetime | None = None,
) -> int:
    """
    Run incremental (or full-reload) ETL.

    Advances watermarks only after a successful load (D-03).
    On load failure the exception propagates and watermarks stay unchanged.
    """
    sync_until = sync_until or utc_day_start()

    reports_wm = None if full_reload else watermarks.get(PIPELINE_REPORTS)
    events_wm = None if full_reload else watermarks.get(PIPELINE_EVENTS)

    batch = extract(
        reports_watermark=reports_wm,
        events_watermark=events_wm,
        sync_until=sync_until,
        full_reload=full_reload,
    )

    if dry_run:
        logger.info(
            json.dumps(
                {
                    "event": "etl_dry_run",
                    "reports": len(getattr(batch, "reports", []) or []),
                    "events": len(getattr(batch, "events", []) or []),
                    "full_reload": full_reload,
                }
            )
        )
        return 0

    # Load first — never advance watermarks on failure (D-03).
    load(
        batch,
        full_reload=full_reload,
    )

    max_report = getattr(batch, "max_report_created_at", None)
    max_event = getattr(batch, "max_event_created_at", None)

    if max_report is not None:
        watermarks.set(PIPELINE_REPORTS, max_report)
    elif full_reload:
        # Empty full reload still clears the watermark high-water mark.
        if hasattr(watermarks, "values"):
            watermarks.values[PIPELINE_REPORTS] = None  # type: ignore[attr-defined]

    if max_event is not None:
        watermarks.set(PIPELINE_EVENTS, max_event)
    elif full_reload:
        if hasattr(watermarks, "values"):
            watermarks.values[PIPELINE_EVENTS] = None  # type: ignore[attr-defined]

    logger.info(
        json.dumps(
            {
                "event": "etl_success",
                "reports": len(getattr(batch, "reports", []) or []),
                "events": len(getattr(batch, "events", []) or []),
                "reports_watermark": max_report.isoformat() if max_report else None,
                "events_watermark": max_event.isoformat() if max_event else None,
                "full_reload": full_reload,
            }
        )
    )
    return 0


# --- Live adapters (imported lazily so unit tests need no GCP/Supabase SDKs) ----


def _project_report_row(row: dict[str, Any]) -> dict[str, Any]:
    return {col: row.get(col) for col in ANALYTICS_REPORT_COLUMNS}


def _project_event_row(row: dict[str, Any]) -> dict[str, Any]:
    projected = {col: row.get(col) for col in ANALYTICS_EVENT_COLUMNS}
    if projected.get("event_id") is not None:
        projected["event_id"] = str(projected["event_id"])
    return projected


def _max_ts(rows: list[dict[str, Any]], key: str = "created_at") -> datetime | None:
    if not rows:
        return None
    return max(_as_datetime(r[key]) for r in rows if r.get(key) is not None)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Incremental Supabase → BigQuery analytics ETL (ANLY-01)."
    )
    parser.add_argument(
        "--full-reload",
        action="store_true",
        help="Truncate analytics tables and reload all projected rows; reset watermarks.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extract and log counts without writing BigQuery or watermarks.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = parse_args(argv)

    try:
        from app.config import Settings
        from app.services.bigquery import BigQueryAnalyticsWarehouse
        from app.services.supabase import SupabaseReportSink

        settings = Settings()
        if not settings.supabase_url or not settings.supabase_secret_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY are required for ETL")
        if not settings.enable_bigquery or not settings.google_cloud_project:
            raise RuntimeError("BigQuery must be enabled with GOOGLE_CLOUD_PROJECT for ETL")

        sb = SupabaseReportSink(settings)
        bq = BigQueryAnalyticsWarehouse(settings)
        sync_until = utc_day_start()

        def extract(
            *,
            reports_watermark: datetime | None,
            events_watermark: datetime | None,
            sync_until: datetime,
            full_reload: bool,
        ) -> ExtractBatch:
            return sb.extract_analytics_batch(
                reports_watermark=reports_watermark,
                events_watermark=events_watermark,
                sync_until=sync_until,
                full_reload=full_reload,
            )

        def load(batch: ExtractBatch, *, full_reload: bool) -> bool:
            return bq.load_analytics_batch(batch, full_reload=full_reload)

        return run_etl(
            extract=extract,
            load=load,
            watermarks=bq,
            full_reload=args.full_reload,
            dry_run=args.dry_run,
            sync_until=sync_until,
        )
    except Exception as exc:
        logger.error(
            json.dumps(
                {
                    "event": "etl_failure",
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                }
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
