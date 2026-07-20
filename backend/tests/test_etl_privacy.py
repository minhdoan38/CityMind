"""ANLY-01 / D-16 — ETL projection must never sync forbidden columns or tables."""

from __future__ import annotations

import pytest

FORBIDDEN_REPORT_FIELDS = frozenset(
    {
        "image_gcs_uri",
        "description",
        "summary",
        "recommendation",
        "uncertainty",
        "urban_context",
        "evidence",
        "access_token",
        "access_token_hash",
        "token_hash",
    }
)

FORBIDDEN_EVENT_FIELDS = frozenset({"note", "actor_id"})


def test_analytics_report_columns_exclude_forbidden() -> None:
    from app.jobs.etl_supabase_to_bigquery import ANALYTICS_REPORT_COLUMNS

    cols = {c.lower() for c in ANALYTICS_REPORT_COLUMNS}
    leaked = cols & FORBIDDEN_REPORT_FIELDS
    assert not leaked, f"Forbidden report columns in allowlist: {sorted(leaked)}"


def test_analytics_event_columns_exclude_forbidden() -> None:
    from app.jobs.etl_supabase_to_bigquery import ANALYTICS_EVENT_COLUMNS

    cols = {c.lower() for c in ANALYTICS_EVENT_COLUMNS}
    leaked = cols & FORBIDDEN_EVENT_FIELDS
    assert not leaked, f"Forbidden event columns in allowlist: {sorted(leaked)}"


def test_etl_extract_select_omits_access_tokens_table() -> None:
    from app.jobs.etl_supabase_to_bigquery import (
        REPORTS_EXTRACT_SELECT,
        EVENTS_EXTRACT_SELECT,
        extract_table_names,
    )

    report_select = REPORTS_EXTRACT_SELECT.lower()
    event_select = EVENTS_EXTRACT_SELECT.lower()
    tables = {t.lower() for t in extract_table_names()}

    assert "access_tokens" not in report_select
    assert "access_tokens" not in event_select
    assert "access_tokens" not in tables


def test_report_allowlist_includes_required_analytics_fields() -> None:
    from app.jobs.etl_supabase_to_bigquery import ANALYTICS_REPORT_COLUMNS

    required = {
        "report_id",
        "created_at",
        "category",
        "priority",
        "current_status",
    }
    cols = {c.lower() for c in ANALYTICS_REPORT_COLUMNS}
    missing = required - cols
    assert not missing, f"Missing required analytics report columns: {sorted(missing)}"
