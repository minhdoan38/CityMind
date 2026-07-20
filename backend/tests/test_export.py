from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api import reports as reports_api
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


def test_export_requires_officer_auth() -> None:
    app.dependency_overrides.clear()
    response = client.get("/api/v1/reports/export", params={"format": "csv"})
    assert response.status_code == 401


def test_export_csv_content_type(monkeypatch) -> None:
    def iter_filtered(**_kwargs):
        yield {
            "report_id": "r1",
            "created_at": "2026-07-20T12:00:00+00:00",
            "category": "pothole",
            "priority": "high",
            "status": "new",
            "summary": "Hole in road",
            "severity": 4,
            "recommendation": "Repair",
            "status_note": None,
        }

    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: SimpleNamespace(iter_filtered=iter_filtered),
    )

    response = client.get("/api/v1/reports/export", params={"format": "csv"})
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers.get("content-disposition", "")
    body = response.text
    assert "report_id" in body
    assert "r1" in body
    assert "Hole in road" in body


def test_export_xlsx_content_type(monkeypatch) -> None:
    def iter_filtered(**_kwargs):
        yield {
            "report_id": "r2",
            "created_at": "2026-07-20T12:00:00+00:00",
            "category": "flooding",
            "priority": "critical",
            "status": "reviewing",
            "summary": "Flooded street",
            "severity": 5,
            "recommendation": "Close lane",
            "status_note": "Crew dispatched",
        }

    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: SimpleNamespace(iter_filtered=iter_filtered),
    )

    response = client.get("/api/v1/reports/export", params={"format": "xlsx"})
    assert response.status_code == 200
    ctype = response.headers["content-type"]
    assert (
        "spreadsheetml" in ctype
        or "excel" in ctype
        or ctype
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.content[:2] == b"PK"  # zip/xlsx magic


def test_export_rejects_invalid_format(monkeypatch) -> None:
    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: SimpleNamespace(iter_filtered=lambda **_: iter(())),
    )
    response = client.get("/api/v1/reports/export", params={"format": "pdf"})
    assert response.status_code == 422
