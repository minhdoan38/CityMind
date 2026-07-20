"""ANLY-02 / D-05 / D-06 / D-14 — SLA single-close + range aggregation helpers."""

from __future__ import annotations

from datetime import date, datetime, timezone

UTC = timezone.utc


def _dt(y: int, m: int, d: int, hh: int = 0, mm: int = 0) -> datetime:
    return datetime(y, m, d, hh, mm, tzinfo=UTC)


def test_sla_single_close_per_report() -> None:
    from app.jobs.etl_supabase_to_bigquery import compute_sla_closed

    reports = [
        {"report_id": "r1", "created_at": _dt(2026, 7, 1, 8)},
        {"report_id": "r2", "created_at": _dt(2026, 7, 2, 8)},
    ]
    events = [
        # Multiple close events for r1 — MIN(resolved/rejected) wins (D-05 / D-14).
        {
            "report_id": "r1",
            "status": "resolved",
            "created_at": _dt(2026, 7, 5, 10),
        },
        {
            "report_id": "r1",
            "status": "resolved",
            "created_at": _dt(2026, 7, 8, 10),
        },
        {
            "report_id": "r1",
            "status": "rejected",
            "created_at": _dt(2026, 7, 4, 12),
        },
        {
            "report_id": "r2",
            "status": "reviewing",
            "created_at": _dt(2026, 7, 3, 9),
        },
    ]

    rows = compute_sla_closed(reports, events)
    by_id = {r["report_id"]: r for r in rows}

    assert set(by_id) == {"r1"}
    assert by_id["r1"]["closed_at"] == _dt(2026, 7, 4, 12)
    assert by_id["r1"]["days_to_close"] == 3  # Jul(4) - Jul(1)


def test_volume_daily_honors_from_to() -> None:
    from app.jobs.etl_supabase_to_bigquery import aggregate_volume_daily

    reports = [
        {"report_id": "a", "created_at": _dt(2026, 7, 1, 12), "category": "flooding"},
        {"report_id": "b", "created_at": _dt(2026, 7, 2, 12), "category": "traffic"},
        {"report_id": "c", "created_at": _dt(2026, 7, 5, 12), "category": "flooding"},
        {"report_id": "d", "created_at": _dt(2026, 6, 30, 12), "category": "noise"},
    ]

    series = aggregate_volume_daily(
        reports, date_from=date(2026, 7, 1), date_to=date(2026, 7, 3)
    )
    by_day = {row["day"]: row["report_count"] for row in series}

    assert by_day == {date(2026, 7, 1): 1, date(2026, 7, 2): 1}
    assert date(2026, 7, 5) not in by_day
    assert date(2026, 6, 30) not in by_day


def test_category_mix_honors_from_to() -> None:
    from app.jobs.etl_supabase_to_bigquery import aggregate_category_mix

    reports = [
        {"report_id": "a", "created_at": _dt(2026, 7, 1), "category": "flooding"},
        {"report_id": "b", "created_at": _dt(2026, 7, 2), "category": "flooding"},
        {"report_id": "c", "created_at": _dt(2026, 7, 2), "category": "traffic"},
        {"report_id": "d", "created_at": _dt(2026, 7, 10), "category": "noise"},
    ]

    mix = aggregate_category_mix(
        reports, date_from=date(2026, 7, 1), date_to=date(2026, 7, 3)
    )
    by_cat = {row["category"]: row["report_count"] for row in mix}

    assert by_cat == {"flooding": 2, "traffic": 1}
    assert "noise" not in by_cat


def test_hotspot_category_ranks_by_volume() -> None:
    from app.jobs.etl_supabase_to_bigquery import aggregate_hotspot_category

    reports = [
        {"report_id": "1", "created_at": _dt(2026, 7, 1), "category": "flooding"},
        {"report_id": "2", "created_at": _dt(2026, 7, 1), "category": "flooding"},
        {"report_id": "3", "created_at": _dt(2026, 7, 1), "category": "flooding"},
        {"report_id": "4", "created_at": _dt(2026, 7, 1), "category": "traffic"},
        {"report_id": "5", "created_at": _dt(2026, 7, 1), "category": "noise"},
        {"report_id": "6", "created_at": _dt(2026, 7, 1), "category": "traffic"},
    ]

    hotspots = aggregate_hotspot_category(
        reports, date_from=date(2026, 7, 1), date_to=date(2026, 7, 1), top_n=2
    )

    assert [h["category"] for h in hotspots] == ["flooding", "traffic"]
    assert hotspots[0]["report_count"] == 3
    assert hotspots[1]["report_count"] == 2
