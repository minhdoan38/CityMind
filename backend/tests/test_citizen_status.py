"""Citizen status lookup API — CIT-02 / CIT-03 / CIT-04 (D-05..D-07, D-10..D-12, D-16..D-18)."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import hashlib
import pytest
from fastapi.testclient import TestClient

from app import security
from app.api import reports as reports_api
from app.main import app
from app.services.tokens import issue_access_token

client = TestClient(app)

CITIZEN_STATUS_UNAUTHORIZED_DETAIL = "We could not verify that report and token."


def _future_expires() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()


def _past_expires() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()


def _status_settings(*, limit: int = 0, trusted_proxy_count: int = 1):
    return SimpleNamespace(
        status_rate_limit_per_minute=limit,
        report_rate_limit_per_minute=0,
        trusted_proxy_count=trusted_proxy_count,
        supabase_url="https://project.supabase.co",
        supabase_publishable_key="pubkey",
        supabase_secret_key="seckey",
        app_env="development",
    )


@pytest.fixture(autouse=True)
def _clear_limiters():
    security.report_limiter.clear()
    if hasattr(security, "status_limiter"):
        security.status_limiter.clear()
    yield
    security.report_limiter.clear()
    if hasattr(security, "status_limiter"):
        security.status_limiter.clear()


def _mock_sink(
    *,
    token_row: dict | None,
    report: dict | None = None,
    history: list[dict] | None = None,
):
    return SimpleNamespace(
        get_access_token_by_hash=lambda _token_hash: token_row,
        get_citizen_status=lambda _report_id: {
            "status": (report or {}).get("status", "new"),
            "summary": (report or {}).get("summary", "A short citizen summary."),
            "history": history
            if history is not None
            else [
                {
                    "status": "reviewing",
                    "note": "Looking into it",
                    "created_at": "2026-07-20T12:00:00+00:00",
                },
                {
                    "status": "new",
                    "note": None,
                    "created_at": "2026-07-19T08:00:00+00:00",
                },
            ],
        },
    )


def test_status_dto_strips_sensitive_fields(monkeypatch) -> None:
    """CIT-02 / D-05 / D-06 / D-07 — allowlist payload, newest-first history, no actor_id."""
    plaintext, token_hash, _ = issue_access_token()
    report_id = "rep-citizen-1"
    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: _mock_sink(
            token_row={
                "token_hash": token_hash,
                "report_id": report_id,
                "expires_at": _future_expires(),
            },
            report={
                "status": "reviewing",
                "summary": "Pothole near the market.",
                "recommendation": "SECRET_REC",
                "evidence": ["SECRET_EV"],
                "confidence": 0.99,
                "severity": 5,
            },
            history=[
                {
                    "status": "reviewing",
                    "note": "Crew assigned",
                    "created_at": "2026-07-20T15:00:00+00:00",
                    "actor_id": "officer-should-not-leak",
                },
                {
                    "status": "new",
                    "note": None,
                    "created_at": "2026-07-19T10:00:00+00:00",
                    "actor_id": "system",
                },
            ],
        ),
    )
    monkeypatch.setattr(security, "get_settings", lambda: _status_settings(limit=0))

    response = client.post(
        "/api/v1/reports/status",
        json={"report_id": report_id, "token": plaintext},
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"status", "summary", "history"}
    assert body["status"] == "reviewing"
    assert body["summary"] == "Pothole near the market."
    assert "recommendation" not in body
    assert "evidence" not in body
    assert "confidence" not in body
    assert "severity" not in body
    assert "actor_id" not in body

    history = body["history"]
    assert len(history) == 2
    assert history[0]["created_at"] >= history[1]["created_at"]
    for item in history:
        assert set(item.keys()) <= {"status", "note", "created_at"}
        assert "actor_id" not in item
    assert history[0]["note"] == "Crew assigned"


def test_uniform_401_no_existence_leak(monkeypatch) -> None:
    """CIT-03 / D-11 / D-16 — missing/wrong/expired/mismatch share one 401 detail."""
    plaintext, token_hash, _ = issue_access_token()
    report_id = "rep-citizen-2"
    wrong_plaintext = "not-the-real-token-value-xxxxxxxxxxxx"

    cases = [
        # Missing hash row
        (
            None,
            report_id,
            plaintext,
        ),
        # Wrong token (hash lookup miss)
        (
            None,
            report_id,
            wrong_plaintext,
        ),
        # Expired token row
        (
            {
                "token_hash": token_hash,
                "report_id": report_id,
                "expires_at": _past_expires(),
            },
            report_id,
            plaintext,
        ),
        # report_id mismatch (binding fail)
        (
            {
                "token_hash": token_hash,
                "report_id": "other-report-id",
                "expires_at": _future_expires(),
            },
            report_id,
            plaintext,
        ),
    ]

    details: list[str] = []
    statuses: list[int] = []

    for token_row, rid, token in cases:
        monkeypatch.setattr(
            reports_api,
            "get_sink",
            lambda row=token_row: _mock_sink(token_row=row),
        )
        monkeypatch.setattr(security, "get_settings", lambda: _status_settings(limit=0))

        response = client.post(
            "/api/v1/reports/status",
            json={"report_id": rid, "token": token},
        )
        statuses.append(response.status_code)
        details.append(response.json().get("detail", ""))

    assert statuses == [401, 401, 401, 401]
    assert len(set(details)) == 1
    assert details[0] == CITIZEN_STATUS_UNAUTHORIZED_DETAIL
    # Never use officer-style 404 for existence (CIT-03)
    assert 404 not in statuses


def test_report_id_binding(monkeypatch) -> None:
    """D-10 — token_hash lookup then compare_digest on report_id; mismatch → 401."""
    plaintext, token_hash, _ = issue_access_token()
    assert token_hash == hashlib.sha256(plaintext.encode()).hexdigest()

    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: _mock_sink(
            token_row={
                "token_hash": token_hash,
                "report_id": "bound-report-a",
                "expires_at": _future_expires(),
            }
        ),
    )
    monkeypatch.setattr(security, "get_settings", lambda: _status_settings(limit=0))

    response = client.post(
        "/api/v1/reports/status",
        json={"report_id": "bound-report-b", "token": plaintext},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == CITIZEN_STATUS_UNAUTHORIZED_DETAIL


def test_status_rate_limit_separate_from_analyze(monkeypatch) -> None:
    """CIT-04 / D-17 — status:{ip} limiter; 429 Retry-After 60; not shared with report_limiter."""
    plaintext, token_hash, _ = issue_access_token()
    report_id = "rep-rate-1"
    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: _mock_sink(
            token_row={
                "token_hash": token_hash,
                "report_id": report_id,
                "expires_at": _future_expires(),
            },
            report={"status": "new", "summary": "Summary text here."},
            history=[],
        ),
    )
    monkeypatch.setattr(security, "get_settings", lambda: _status_settings(limit=1))

    assert hasattr(security, "status_limiter")
    security.status_limiter.clear()
    security.report_limiter.clear()

    allowed_keys: list[str] = []
    real_allow = security.status_limiter.allow

    def tracking_allow(key, limit, now=None):
        allowed_keys.append(key)
        return real_allow(key, limit, now=now)

    monkeypatch.setattr(security.status_limiter, "allow", tracking_allow)

    headers = {"X-Forwarded-For": "203.0.113.50"}
    first = client.post(
        "/api/v1/reports/status",
        json={"report_id": report_id, "token": plaintext},
        headers=headers,
    )
    second = client.post(
        "/api/v1/reports/status",
        json={"report_id": report_id, "token": plaintext},
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["retry-after"] == "60"
    assert all(k.startswith("status:") for k in allowed_keys)
    assert allowed_keys[0] == "status:203.0.113.50"
    # report_limiter must remain unused by status path
    assert len(security.report_limiter._events) == 0
