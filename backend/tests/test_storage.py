import pytest
from types import SimpleNamespace
from app.services.storage import EvidenceStorage
from app.config import Settings


class MockStorageBucket:
    def __init__(self, bucket_name):
        self.bucket_name = bucket_name
        self.uploaded_files = {}

    def upload(self, path, file, file_options=None):
        self.uploaded_files[path] = {
            "content": file,
            "options": file_options,
        }
        return self

    def download(self, path):
        if path not in self.uploaded_files:
            raise KeyError(f"File not found: {path}")
        return self.uploaded_files[path]["content"]


class MockStorageClient:
    def __init__(self):
        self.buckets = {}

    def from_(self, bucket_name):
        if bucket_name not in self.buckets:
            self.buckets[bucket_name] = MockStorageBucket(bucket_name)
        return self.buckets[bucket_name]


class MockSupabaseClient:
    def __init__(self):
        self.storage = MockStorageClient()


@pytest.fixture
def mock_storage(monkeypatch):
    mock_client = MockSupabaseClient()
    monkeypatch.setattr("app.services.storage.create_client", lambda url, key, **kwargs: mock_client)
    return mock_client


def test_upload_image_saves_to_supabase_bucket(mock_storage) -> None:
    settings = Settings(
        enable_image_storage=True,
        supabase_url="https://test.supabase.co",
        supabase_secret_key="secret",
        supabase_bucket_name="evidence"
    )
    storage_svc = EvidenceStorage(settings)

    uri = storage_svc.upload_image("rep-123", b"fake_image_bytes", "image/png")
    
    assert uri == "supabase://evidence/reports/rep-123/evidence.png"
    uploaded = mock_storage.storage.from_("evidence").uploaded_files["reports/rep-123/evidence.png"]
    assert uploaded["content"] == b"fake_image_bytes"
    assert uploaded["options"]["content-type"] == "image/png"


def test_download_image_by_supabase_uri(mock_storage) -> None:
    settings = Settings(
        enable_image_storage=True,
        supabase_url="https://test.supabase.co",
        supabase_secret_key="secret",
        supabase_bucket_name="evidence"
    )
    storage_svc = EvidenceStorage(settings)

    # Seed mock storage
    mock_storage.storage.from_("evidence").upload("reports/rep-123/evidence.png", b"saved_data")

    data, mime_type = storage_svc.download_by_gcs_uri("supabase://evidence/reports/rep-123/evidence.png")
    
    assert data == b"saved_data"
    assert mime_type == "image/png"


def test_unsupported_mime_type_raises_error() -> None:
    settings = Settings(
        enable_image_storage=True,
        supabase_url="https://test.supabase.co",
        supabase_secret_key="secret",
        supabase_bucket_name="evidence"
    )
    storage_svc = EvidenceStorage(settings)

    with pytest.raises(RuntimeError) as exc:
        storage_svc.upload_image("rep-123", b"bytes", "image/gif")
    
    assert "Unsupported image MIME type" in str(exc.value)
