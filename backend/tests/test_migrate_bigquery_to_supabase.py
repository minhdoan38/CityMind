import pytest
from types import SimpleNamespace
from datetime import datetime, timezone
import scripts.migrate_bigquery_to_supabase as migration
from app.config import Settings


class MockBigQueryRow(dict):
    pass


class MockBigQueryClient:
    def __init__(self, reports, events):
        self.reports = reports
        self.events = events

    def query(self, query_string, *args, **kwargs):
        class MockQueryJob:
            def __init__(self, data):
                self._data = data
            def result(self):
                return [MockBigQueryRow(r) for r in self._data]

        if "report_status_events" in query_string:
            return MockQueryJob(self.events)
        return MockQueryJob(self.reports)


class MockSupabaseTable:
    def __init__(self, table_name, store):
        self.table_name = table_name
        self.store = store

    def select(self, columns):
        return self

    def insert(self, rows):
        if self.table_name not in self.store:
            self.store[self.table_name] = []
        # Store a copy of the inserted items
        for r in rows:
            self.store[self.table_name].append(r.copy())
        return self

    def execute(self):
        data = self.store.get(self.table_name, [])
        return SimpleNamespace(data=data)


class MockSupabaseClient:
    def __init__(self):
        self.store = {
            "reports": [],
            "status_events": [],
        }

    def table(self, table_name):
        return MockSupabaseTable(table_name, self.store)


@pytest.fixture
def mock_clients(monkeypatch):
    bq_reports = [
        {
            "report_id": "bq-1",
            "created_at": datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc),
            "description": "Flooded road",
            "category": "flooding",
            "priority": "high",
        }
    ]
    bq_events = [
        {
            "report_id": "bq-1",
            "status": "resolved",
            "note": "Drain cleared",
            "created_at": datetime(2026, 7, 20, 12, 30, tzinfo=timezone.utc),
        }
    ]
    bq_client = MockBigQueryClient(bq_reports, bq_events)
    sb_client = MockSupabaseClient()

    monkeypatch.setattr("google.cloud.bigquery.Client", lambda *args, **kwargs: bq_client)
    monkeypatch.setattr("scripts.migrate_bigquery_to_supabase.create_client", lambda url, key, **kwargs: sb_client)

    return bq_client, sb_client


def test_dry_run_does_not_mutate_supabase(mock_clients) -> None:
    bq, sb = mock_clients
    settings = Settings(supabase_url="http://mock.url", supabase_secret_key="mock_secret")
    
    exit_code = migration.migrate(settings, dry_run=True)
    
    assert exit_code == 0
    assert len(sb.store["reports"]) == 0
    assert len(sb.store["status_events"]) == 0


def test_apply_migrates_records_and_is_idempotent(mock_clients) -> None:
    bq, sb = mock_clients
    settings = Settings(supabase_url="http://mock.url", supabase_secret_key="mock_secret")
    
    # Run once (apply + verify)
    exit_code = migration.migrate(settings, apply=True, verify=True)
    assert exit_code == 0
    assert len(sb.store["reports"]) == 1
    assert sb.store["reports"][0]["report_id"] == "bq-1"
    assert len(sb.store["status_events"]) == 1
    assert sb.store["status_events"][0]["status"] == "resolved"

    # Run again (proves idempotency, should not insert duplicates)
    exit_code_again = migration.migrate(settings, apply=True, verify=True)
    assert exit_code_again == 0
    assert len(sb.store["reports"]) == 1
    assert len(sb.store["status_events"]) == 1


def test_reconciliation_fails_on_missing_records(mock_clients) -> None:
    bq, sb = mock_clients
    settings = Settings(supabase_url="http://mock.url", supabase_secret_key="mock_secret")
    
    # Run verification only without applying first (reconciliation should fail)
    exit_code = migration.migrate(settings, verify=True)
    assert exit_code == 1
