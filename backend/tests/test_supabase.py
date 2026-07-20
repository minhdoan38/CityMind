import pytest
from types import SimpleNamespace
from datetime import datetime, timezone
from app.services.supabase import SupabaseReportSink
from app.config import Settings
from app.schemas import ReportAnalysis, Category, Priority


class MockSupabaseTable:
    def __init__(self, table_name, data_store):
        self.table_name = table_name
        self.data_store = data_store
        self._eq_filters = {}
        self._order_by = None
        self._limit_val = None
        self._update_row = None

    def insert(self, row):
        if self.table_name not in self.data_store:
            self.data_store[self.table_name] = []
        self.data_store[self.table_name].append(row)
        return self

    def select(self, columns):
        return self

    def eq(self, column, value):
        self._eq_filters[column] = value
        return self

    def gte(self, column, value):
        return self

    def lte(self, column, value):
        return self

    def order(self, column, desc=True):
        self._order_by = (column, desc)
        return self

    def limit(self, value):
        self._limit_val = value
        return self

    def update(self, row):
        self._update_row = row
        return self

    def execute(self):
        # Retrieve items for the table
        items = self.data_store.get(self.table_name, [])
        if hasattr(self, "_update_row") and self._update_row is not None:
            for item in items:
                match = True
                for col, val in self._eq_filters.items():
                    if item.get(col) != val:
                        match = False
                        break
                if match:
                    item.update(self._update_row)
            return SimpleNamespace(data=items)

        filtered_items = []
        
        for item in items:
            match = True
            for col, val in self._eq_filters.items():
                if item.get(col) != val:
                    match = False
                    break
            if match:
                # Add mock relation status_events if querying reports
                if self.table_name == "reports":
                    report_id = item.get("report_id")
                    events = self.data_store.get("status_events", [])
                    item["status_events"] = [e for e in events if e.get("report_id") == report_id]
                filtered_items.append(item)
                
        return SimpleNamespace(data=filtered_items)


class MockSupabaseClient:
    def __init__(self):
        self.data_store = {
            "reports": [],
            "status_events": [],
        }

    def table(self, table_name):
        return MockSupabaseTable(table_name, self.data_store)


@pytest.fixture
def mock_supabase(monkeypatch):
    mock_client = MockSupabaseClient()
    monkeypatch.setattr("app.services.supabase.create_client", lambda url, key, **kwargs: mock_client)
    return mock_client


def test_insert_saves_to_postgres(mock_supabase) -> None:
    settings = Settings(supabase_url="https://test.supabase.co", supabase_secret_key="secret")
    sink = SupabaseReportSink(settings)

    analysis = ReportAnalysis(
        category=Category.POTHOLE,
        severity=3,
        confidence=0.9,
        summary="Test pothole summary",
        recommendation="Repair soon",
        priority=Priority.MEDIUM,
        estimated_impact="Low impact",
        evidence=["img1.jpg"],
        uncertainty=[]
    )

    success = sink.insert(
        report_id="rep-123",
        description="Pothole in the road",
        latitude=10.0,
        longitude=20.0,
        analysis=analysis,
        urban_context={"weather": "sunny"},
        image_gcs_uri="supabase://evidence/reports/rep-123/evidence.jpg"
    )

    assert success is True
    reports = mock_supabase.data_store["reports"]
    assert len(reports) == 1
    assert reports[0]["report_id"] == "rep-123"
    assert reports[0]["description"] == "Pothole in the road"
    assert reports[0]["image_gcs_uri"] == "supabase://evidence/reports/rep-123/evidence.jpg"
    assert reports[0]["category"] == "pothole"


def test_update_status_appends_event(mock_supabase) -> None:
    settings = Settings(supabase_url="https://test.supabase.co", supabase_secret_key="secret")
    sink = SupabaseReportSink(settings)

    mock_supabase.data_store["reports"].append(
        {"report_id": "rep-123", "current_status": "new"}
    )

    sink.update_status(
        report_id="rep-123",
        status="reviewing",
        note="Officer assigned",
        actor_id="officer-sub-xyz",
    )

    events = mock_supabase.data_store["status_events"]
    assert len(events) == 1
    assert events[0]["report_id"] == "rep-123"
    assert events[0]["status"] == "reviewing"
    assert events[0]["note"] == "Officer assigned"
    assert events[0]["actor_id"] == "officer-sub-xyz"
    assert mock_supabase.data_store["reports"][0]["current_status"] == "reviewing"


def test_get_report_returns_mapped_object(mock_supabase) -> None:
    settings = Settings(supabase_url="https://test.supabase.co", supabase_secret_key="secret")
    sink = SupabaseReportSink(settings)

    # Pre-populate mock DB
    mock_supabase.data_store["reports"].append({
        "report_id": "rep-123",
        "created_at": "2026-07-20T12:00:00Z",
        "description": "Test report",
        "latitude": 10.0,
        "longitude": 20.0,
        "category": "flooding",
        "severity": 4,
        "confidence": 0.8,
        "summary": "Flooding on main street",
        "recommendation": "Use detour",
        "priority": "high",
        "estimated_impact": "High",
        "evidence": [],
        "uncertainty": [],
        "urban_context": {},
        "image_gcs_uri": None
    })
    mock_supabase.data_store["status_events"].append({
        "report_id": "rep-123",
        "status": "resolved",
        "note": "Drain cleared",
        "created_at": "2026-07-20T12:30:00Z"
    })

    report = sink.get_report("rep-123")
    assert report is not None
    assert report["report_id"] == "rep-123"
    assert report["status"] == "resolved"
    assert report["status_note"] == "Drain cleared"
