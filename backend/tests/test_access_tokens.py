import hashlib
from datetime import datetime, timezone

from app.config import Settings
from app.services.supabase import SupabaseReportSink
from app.services.tokens import issue_access_token


def test_issue_access_token_hashes_plaintext_and_sets_ttl():
    plaintext, token_hash, expires_at = issue_access_token()
    assert plaintext is not None
    assert len(plaintext) > 10
    assert token_hash == hashlib.sha256(plaintext.encode()).hexdigest()
    assert len(token_hash) == 64
    assert token_hash != plaintext

    delta = expires_at - datetime.now(timezone.utc)
    assert 364 <= delta.days <= 366


def test_insert_access_token_persists_hash_only(monkeypatch):
    settings = Settings(
        supabase_url="http://mock",
        supabase_publishable_key="mock",
        supabase_secret_key="mock",
    )
    sink = SupabaseReportSink(settings)

    called_rows = []

    class MockTable:
        def insert(self, row):
            called_rows.append(row)
            return self

        def execute(self):
            return self

    class MockClient:
        def table(self, name):
            assert name == "access_tokens"
            return MockTable()

    monkeypatch.setattr(sink, "get_client", lambda *args, **kwargs: MockClient())

    plaintext, token_hash, expires_at = issue_access_token()
    res = sink.insert_access_token("report-123", token_hash, expires_at)
    assert res is True
    assert len(called_rows) == 1
    row = called_rows[0]
    assert row["report_id"] == "report-123"
    assert row["token_hash"] == token_hash
    assert plaintext not in row.values()
    assert "expires_at" in row
    assert row["expires_at"] is not None
