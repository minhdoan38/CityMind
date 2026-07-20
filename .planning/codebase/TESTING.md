# Testing Patterns

**Analysis Date:** 2026-07-20

## Test Framework

**Runner:**
- pytest 8.4.1
- Config: `backend/pyproject.toml` (sets `testpaths = ["tests"]`, `pythonpath = ["."]`)

**Assertion Library:**
- pytest built-in assertions

**Run Commands:**
```bash
cd backend
pytest -q
```

## Test File Organization

**Location:**
- `backend/tests/*.py`

**Naming:**
- `test_<module>.py` style:
  - `test_gemini.py`, `test_bigquery.py`, `test_context_data.py`, `test_security.py`, `test_reports.py`, etc.

## Test Structure

**Suite Organization:**
- Tests are plain functions (no custom pytest classes)
- Arrange/Act/Assert is expressed via:
  - fixture-like helpers at the top of the file
  - inline `monkeypatch` and `SimpleNamespace` stubs

**Patterns:**
- Parameterized tests with `@pytest.mark.parametrize` for boundary checks (e.g., filter validation)
- Fast API tests use `fastapi.testclient.TestClient` against `backend/app/main.py::app`

## Mocking

**Framework:**
- pytest `monkeypatch` for dependency replacement

**Patterns:**
```python
# API tests: replace the backend service factory used by the router
monkeypatch.setattr(reports_api, "get_sink", lambda: sink_stub)

# Network tests: replace HTTP client used inside the service
monkeypatch.setattr("app.services.context_data.requests.get", fake_get)
```

**What to Mock (observed):**
- External SDK behavior:
  - Gemini analyzer calls are mocked by stubbing `GeminiAnalyzer.client.models.generate_content`
- BigQuery client behavior:
  - Query/insert behavior is replaced with fakes (`FakeClient`, `FakeJob`)
- Network calls (OpenWeather/Nominatim):
  - `requests.get` is faked per endpoint type

## Fixtures and Factories

**Test Data:**
- Small constant dicts representing valid/invalid Gemini outputs (e.g., `VALID_ANALYSIS` in `test_gemini.py`)
- Fake client objects created inline or via helper constructors (`enabled_sink`, `FakeClient`)

## Coverage

**Requirements:**
- No explicit coverage target found in config/scripts.

## Test Types

**Unit Tests:**
- Service-level behavior and edge cases:
  - `backend/tests/test_gemini.py`
  - `backend/tests/test_context_data.py`
  - `backend/tests/test_bigquery.py`

**Integration-ish API Tests:**
- FastAPI router boundary tests via `TestClient`:
  - `backend/tests/test_reports.py`
  - `backend/tests/test_security.py`

---
*Testing analysis: 2026-07-20*
*Update when test patterns change*

