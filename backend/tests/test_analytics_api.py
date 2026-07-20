"""Officer analytics API — ANLY-03 / D-07 / D-13 / D-18 (Wave 0 Nyquist stubs)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
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
