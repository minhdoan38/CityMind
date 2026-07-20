from pathlib import Path


def test_postgis_migration_contains_extension_and_index() -> None:
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase/migrations/20260721_000001_postgis.sql").read_text(
        encoding="utf-8"
    )
    assert "CREATE EXTENSION" in sql
    assert "geography" in sql
    assert "reports_geog_gist_idx" in sql


def test_geo_pins_rpc_migration_exists() -> None:
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase/migrations/20260721_000002_geo_pins_rpc.sql").read_text(
        encoding="utf-8"
    )
    assert "get_report_geo_pins" in sql
    assert "ST_Intersects" in sql
