"""Officer analytics API — ANLY-03 / D-07 / D-13 / D-18."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import analytics as analytics_api
from app.schemas import (
    AnalyticsResponse,
    AnalyticsSlaSummary,
    AnalyticsVolumePoint,
)
from app.security import OfficerPrincipal, require_officer

client = TestClient(app)


@pytest.fixture(autouse=True)
def mock_require_officer():
    app.dependency_overrides[require_officer] = lambda: OfficerPrincipal(
        token="mock_token",
        actor_id="officer-sub-001",
        role="officer",
    )
    yield
    app.dependency_overrides.clear()


def test_officer_analytics_requires_auth() -> None:
    """ANLY-03 / D-07 — GET /api/v1/analytics without officer JWT → 401."""
    app.dependency_overrides.clear()
    response = client.get(
        "/api/v1/analytics",
        params={"from": "2026-06-01", "to": "2026-06-30"},
    )
    assert response.status_code == 401


def test_invalid_range_422() -> None:
    """ANLY-03 — from after to → 422 (D-13 / D-18 date validation)."""
    response = client.get(
        "/api/v1/analytics",
        params={"from": "2026-07-01", "to": "2026-06-01"},
    )
    assert response.status_code == 422
    assert "from" in response.json()["detail"].lower() or "range" in response.json()[
        "detail"
    ].lower()


def test_span_exceeds_max_422() -> None:
    """Optional clamp — span > 366 days → 422."""
    response = client.get(
        "/api/v1/analytics",
        params={"from": "2025-01-01", "to": "2026-12-31"},
    )
    assert response.status_code == 422


def test_analytics_returns_empty_warehouse(monkeypatch) -> None:
    """D-10 — empty warehouse signals empty:true with empty arrays."""

    class FakeService:
        def fetch(self, date_from: date, date_to: date) -> AnalyticsResponse:
            return AnalyticsResponse(
                from_date=date_from,
                to_date=date_to,
                empty=True,
                volume=[],
                category_mix=[],
                sla=AnalyticsSlaSummary(),
                hotspots=[],
            )

    monkeypatch.setattr(
        analytics_api, "get_analytics_service", lambda: FakeService()
    )

    response = client.get(
        "/api/v1/analytics",
        params={"from": "2026-06-01", "to": "2026-06-30"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["empty"] is True
    assert body["volume"] == []
    assert body["category_mix"] == []
    assert body["hotspots"] == []
    assert body["from"] == "2026-06-01"
    assert body["to"] == "2026-06-30"
    assert "evidence" not in body
    assert "access_token" not in body


def test_analytics_returns_chart_payload(monkeypatch) -> None:
    """Happy path — volume/category/sla/hotspots for authenticated officer."""

    class FakeService:
        def fetch(self, date_from: date, date_to: date) -> AnalyticsResponse:
            return AnalyticsResponse(
                from_date=date_from,
                to_date=date_to,
                empty=False,
                volume=[
                    AnalyticsVolumePoint(day=date(2026, 6, 1), report_count=3),
                ],
                category_mix=[],
                sla=AnalyticsSlaSummary(
                    closed_count=1, median_days=2.0, avg_days=2.0
                ),
                hotspots=[],
            )

    monkeypatch.setattr(
        analytics_api, "get_analytics_service", lambda: FakeService()
    )

    response = client.get(
        "/api/v1/analytics",
        params={"from": "2026-06-01", "to": "2026-06-30"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["empty"] is False
    assert body["volume"][0]["report_count"] == 3
    assert body["sla"]["closed_count"] == 1
