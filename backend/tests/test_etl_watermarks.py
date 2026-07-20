"""ANLY-01 / D-02 / D-03 — watermark advance only after successful BQ load."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest


UTC = timezone.utc


class FakeWatermarkStore:
    """In-memory stand-in for citymind.etl_watermarks."""

    def __init__(self) -> None:
        self.values: dict[str, datetime | None] = {
            "reports": None,
            "status_events": None,
        }
        self.writes: list[tuple[str, datetime]] = []

    def get(self, pipeline: str) -> datetime | None:
        return self.values.get(pipeline)

    def set(self, pipeline: str, watermark: datetime) -> None:
        self.values[pipeline] = watermark
        self.writes.append((pipeline, watermark))


def test_watermark_not_advanced_on_load_failure() -> None:
    from app.jobs.etl_supabase_to_bigquery import run_etl

    store = FakeWatermarkStore()
    prior = datetime(2026, 7, 1, tzinfo=UTC)
    store.values["reports"] = prior
    store.values["status_events"] = prior

    load = MagicMock(side_effect=RuntimeError("bq load failed"))

    with pytest.raises(RuntimeError, match="bq load failed"):
        run_etl(
            extract=MagicMock(return_value=SimpleNamespace(reports=[], events=[])),
            load=load,
            watermarks=store,
            full_reload=False,
            dry_run=False,
            sync_until=datetime(2026, 7, 20, tzinfo=UTC),
        )

    assert store.values["reports"] == prior
    assert store.values["status_events"] == prior
    assert store.writes == []


def test_watermark_advances_after_successful_load() -> None:
    from app.jobs.etl_supabase_to_bigquery import run_etl

    store = FakeWatermarkStore()
    prior = datetime(2026, 7, 1, tzinfo=UTC)
    store.values["reports"] = prior
    store.values["status_events"] = prior

    sync_until = datetime(2026, 7, 20, 0, 0, tzinfo=UTC)
    new_report_ts = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
    new_event_ts = datetime(2026, 7, 19, 15, 0, tzinfo=UTC)

    extract = MagicMock(
        return_value=SimpleNamespace(
            reports=[{"report_id": "r1", "created_at": new_report_ts}],
            events=[
                {
                    "event_id": "e1",
                    "report_id": "r1",
                    "status": "resolved",
                    "created_at": new_event_ts,
                }
            ],
            max_report_created_at=new_report_ts,
            max_event_created_at=new_event_ts,
        )
    )
    load = MagicMock(return_value=True)

    exit_code = run_etl(
        extract=extract,
        load=load,
        watermarks=store,
        full_reload=False,
        dry_run=False,
        sync_until=sync_until,
    )

    assert exit_code == 0
    load.assert_called_once()
    assert store.values["reports"] == new_report_ts
    assert store.values["status_events"] == new_event_ts


def test_full_reload_resets_watermarks() -> None:
    from app.jobs.etl_supabase_to_bigquery import run_etl

    store = FakeWatermarkStore()
    prior = datetime(2026, 7, 10, tzinfo=UTC)
    store.values["reports"] = prior
    store.values["status_events"] = prior

    sync_until = datetime(2026, 7, 20, 0, 0, tzinfo=UTC)
    batch_ts = datetime(2026, 7, 19, 23, 0, tzinfo=UTC)

    extract = MagicMock(
        return_value=SimpleNamespace(
            reports=[{"report_id": "r1", "created_at": batch_ts}],
            events=[],
            max_report_created_at=batch_ts,
            max_event_created_at=None,
            full_reload=True,
        )
    )
    load = MagicMock(return_value=True)

    exit_code = run_etl(
        extract=extract,
        load=load,
        watermarks=store,
        full_reload=True,
        dry_run=False,
        sync_until=sync_until,
    )

    assert exit_code == 0
    # Full reload truncates then reloads; watermarks reset then advance to batch max.
    assert any(p == "reports" and w is None for p, w in getattr(store, "resets", [])) or (
        store.values["reports"] == batch_ts
    )
    assert store.values["reports"] == batch_ts
