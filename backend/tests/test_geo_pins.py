from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api import reports as reports_api
from app.main import app
from app.security import OfficerPrincipal, require_officer
from app.services.supabase import GEO_PIN_FIELDS, parse_bbox

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


def test_requires_auth() -> None:
    app.dependency_overrides.clear()
    response = client.get(
        "/api/v1/reports/geo/pins",
        params={"west": 105.0, "south": 20.0, "east": 106.0, "north": 22.0},
    )
    assert response.status_code == 401


def test_invalid_bbox() -> None:
    response = client.get(
        "/api/v1/reports/geo/pins",
        params={"west": 106.0, "south": 20.0, "east": 105.0, "north": 22.0},
    )
    assert response.status_code == 422


def test_skips_unlocated_via_rpc(monkeypatch) -> None:
    def list_geo_pins(**_kwargs):
        return (
            [
                {
                    "report_id": "r1",
                    "latitude": 21.0,
                    "longitude": 105.8,
                    "priority": "high",
                    "status": "new",
                    "category": "infrastructure",
                    "created_at": "2026-01-01T00:00:00Z",
                }
            ],
            2,
        )

    sink = SimpleNamespace(list_geo_pins=list_geo_pins)
    monkeypatch.setattr(reports_api, "get_sink", lambda: sink)

    response = client.get(
        "/api/v1/reports/geo/pins",
        params={"west": 105.0, "south": 20.0, "east": 106.0, "north": 22.0},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["unlocated_count"] == 2
    assert len(body["pins"]) == 1


def test_pin_projection(monkeypatch) -> None:
    forbidden = {"description", "summary", "token", "image_gcs_uri", "status_note"}

    def list_geo_pins(**_kwargs):
        pin = {
            "report_id": "r1",
            "latitude": 21.0,
            "longitude": 105.8,
            "priority": "high",
            "status": "new",
            "category": "infrastructure",
            "created_at": "2026-01-01T00:00:00Z",
        }
        return ([pin], 0)

    sink = SimpleNamespace(list_geo_pins=list_geo_pins)
    monkeypatch.setattr(reports_api, "get_sink", lambda: sink)

    response = client.get(
        "/api/v1/reports/geo/pins",
        params={"west": 105.0, "south": 20.0, "east": 106.0, "north": 22.0},
    )
    pin = response.json()["pins"][0]
    assert set(pin.keys()) == set(GEO_PIN_FIELDS)
    assert not forbidden.intersection(pin.keys())


def test_unlocated_count(monkeypatch) -> None:
    def list_geo_pins(**_kwargs):
        return ([], 4)

    sink = SimpleNamespace(list_geo_pins=list_geo_pins)
    monkeypatch.setattr(reports_api, "get_sink", lambda: sink)

    response = client.get(
        "/api/v1/reports/geo/pins",
        params={"west": 105.0, "south": 20.0, "east": 106.0, "north": 22.0},
    )
    assert response.json()["unlocated_count"] == 4


def test_parse_bbox_valid() -> None:
    assert parse_bbox("105,20,106,22") == (105.0, 20.0, 106.0, 22.0)


def test_parse_bbox_invalid() -> None:
    with pytest.raises(ValueError):
        parse_bbox("106,20,105,22")


def test_postgis_migration_sql() -> None:
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase/migrations/20260721_000001_postgis.sql").read_text(
        encoding="utf-8"
    )
    assert "postgis" in sql.lower()
    assert "geog" in sql
    assert "GIST" in sql
