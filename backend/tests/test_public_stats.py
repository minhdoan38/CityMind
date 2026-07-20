"""Public Home stats API — D-11 / D-12 / D-13 / D-17 (k-anonymity + rate limit)."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import security
from app.api import analytics as analytics_api
from app.main import app
from app.schemas import PublicCategoryStat, PublicStatsResponse
from app.services.analytics import AnalyticsCategoryCount, _public_top_categories

client = TestClient(app)


def _public_stats_settings(*, limit: int = 0, trusted_proxy_count: int = 1):
    return SimpleNamespace(
        public_stats_rate_limit_per_minute=limit,
        status_rate_limit_per_minute=0,
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
    security.status_limiter.clear()
    if hasattr(security, "public_stats_limiter"):
        security.public_stats_limiter.clear()
    yield
    security.report_limiter.clear()
    security.status_limiter.clear()
    if hasattr(security, "public_stats_limiter"):
        security.public_stats_limiter.clear()


def test_public_top_categories_filters_k_anonymity() -> None:
    """D-17 — service helper drops cells under 3 and caps at two categories."""
    raw = [
        AnalyticsCategoryCount(category="pothole", report_count=10),
        AnalyticsCategoryCount(category="lighting", report_count=5),
        AnalyticsCategoryCount(category="graffiti", report_count=2),
        AnalyticsCategoryCount(category="noise", report_count=4),
    ]

    top = _public_top_categories(raw)
    assert len(top) == 2
    assert top[0].category == "pothole"
    assert top[1].category == "lighting"
    assert all(item.count >= 3 for item in top)


def test_public_stats_k_anonymity_omits_small_cells(monkeypatch) -> None:
    """D-17 — categories with count under 3 omitted; top 1–2 only (D-11)."""

    class FakeService:
        def fetch_public_stats(self) -> PublicStatsResponse:
            return PublicStatsResponse(
                total_last_30d=42,
                top_categories=[
                    PublicCategoryStat(category="pothole", count=10),
                    PublicCategoryStat(category="lighting", count=5),
                ],
            )

    monkeypatch.setattr(
        analytics_api, "get_analytics_service", lambda: FakeService()
    )
    monkeypatch.setattr(
        security, "get_settings", lambda: _public_stats_settings(limit=0)
    )

    response = client.get("/api/v1/public/stats")
    assert response.status_code == 200
    body = response.json()
    assert body["total_last_30d"] == 42
    categories = body["top_categories"]
    assert len(categories) <= 2
    assert all(item["count"] >= 3 for item in categories)
    assert "pothole" in {item["category"] for item in categories}
    assert "lighting" in {item["category"] for item in categories}
    # Small cells must never appear as named categories
    assert "graffiti" not in {item["category"] for item in categories}


def test_public_stats_payload_allowlist(monkeypatch) -> None:
    """D-11 / D-16 — count/category only; no lat/lng, tokens, evidence, notes."""

    class FakeService:
        def fetch_public_stats(self) -> PublicStatsResponse:
            return PublicStatsResponse(
                total_last_30d=7,
                top_categories=[PublicCategoryStat(category="noise", count=4)],
            )

    monkeypatch.setattr(
        analytics_api, "get_analytics_service", lambda: FakeService()
    )
    monkeypatch.setattr(
        security, "get_settings", lambda: _public_stats_settings(limit=0)
    )

    response = client.get("/api/v1/public/stats")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"total_last_30d", "top_categories"}
    assert set(body["top_categories"][0].keys()) == {"category", "count"}
    forbidden = {
        "lat",
        "lng",
        "latitude",
        "longitude",
        "description",
        "evidence",
        "access_token",
        "token",
        "note",
        "summary",
    }
    assert forbidden.isdisjoint(body.keys())
    assert forbidden.isdisjoint(body["top_categories"][0].keys())


def test_public_stats_rate_limit_separate_from_status(monkeypatch) -> None:
    """D-13 — stats:{ip} limiter; 429 Retry-After 60; not shared with status/analyze."""

    class FakeService:
        def fetch_public_stats(self) -> PublicStatsResponse:
            return PublicStatsResponse(
                total_last_30d=0,
                top_categories=[],
            )

    monkeypatch.setattr(
        analytics_api, "get_analytics_service", lambda: FakeService()
    )
    monkeypatch.setattr(
        security, "get_settings", lambda: _public_stats_settings(limit=1)
    )

    assert hasattr(security, "public_stats_limiter")
    security.public_stats_limiter.clear()
    security.status_limiter.clear()
    security.report_limiter.clear()

    allowed_keys: list[str] = []
    real_allow = security.public_stats_limiter.allow

    def tracking_allow(key, limit, now=None):
        allowed_keys.append(key)
        return real_allow(key, limit, now=now)

    monkeypatch.setattr(security.public_stats_limiter, "allow", tracking_allow)

    headers = {"X-Forwarded-For": "203.0.113.99"}
    first = client.get("/api/v1/public/stats", headers=headers)
    second = client.get("/api/v1/public/stats", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["retry-after"] == "60"
    assert all(k.startswith("stats:") for k in allowed_keys)
    assert allowed_keys[0] == "stats:203.0.113.99"
    assert len(security.status_limiter._events) == 0
    assert len(security.report_limiter._events) == 0
