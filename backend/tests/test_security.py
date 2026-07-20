from types import SimpleNamespace
import pytest
import jwt
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app import security
from app.api import reports as reports_api
from app.config import Settings
from app.main import app

client = TestClient(app)


def security_settings(url="https://project.supabase.co", app_env="development", limit=0):
    return SimpleNamespace(
        supabase_url=url,
        supabase_publishable_key="pubkey",
        supabase_secret_key="seckey",
        supabase_jwt_audience="authenticated",
        supabase_jwt_issuer="",
        supabase_jwks_url="",
        app_env=app_env,
        report_rate_limit_per_minute=limit,
    )


def test_protected_endpoint_requires_auth_header(monkeypatch) -> None:
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(app_env="production"),
    )

    response = client.get("/api/v1/reports/recent")

    assert response.status_code == 401
    assert response.json()["detail"] == "Officer authentication required"


def test_protected_endpoint_accepts_valid_jwt(monkeypatch) -> None:
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(app_env="production"),
    )
    
    # Mock jwt.decode and PyJWKClient.get_signing_key_from_jwt
    class MockSigningKey:
        key = "mock_key"

    class MockJWKClient:
        def __init__(self, *args, **kwargs):
            pass
        def get_signing_key_from_jwt(self, *args, **kwargs):
            return MockSigningKey()

    monkeypatch.setattr(security, "PyJWKClient", MockJWKClient)
    
    def mock_decode(token, key, **kwargs):
        return {
            "aud": "authenticated",
            "iss": "https://project.supabase.co/auth/v1",
            "app_metadata": {"role": "officer"},
            "exp": 9999999999
        }
    monkeypatch.setattr(jwt, "decode", mock_decode)
    
    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: SimpleNamespace(list_recent=lambda *_args, **_kwargs: []),
    )

    response = client.get(
        "/api/v1/reports/recent",
        headers={"Authorization": "Bearer valid_token"},
    )

    assert response.status_code == 200


def test_rejects_insufficient_role(monkeypatch) -> None:
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(app_env="production"),
    )
    
    class MockSigningKey:
        key = "mock_key"

    class MockJWKClient:
        def __init__(self, *args, **kwargs):
            pass
        def get_signing_key_from_jwt(self, *args, **kwargs):
            return MockSigningKey()

    monkeypatch.setattr(security, "PyJWKClient", MockJWKClient)
    
    def mock_decode(token, key, **kwargs):
        return {
            "aud": "authenticated",
            "app_metadata": {"role": "citizen"}, # wrong role
        }
    monkeypatch.setattr(jwt, "decode", mock_decode)

    response = client.get(
        "/api/v1/reports/recent",
        headers={"Authorization": "Bearer valid_token"},
    )

    assert response.status_code == 403
    assert "insufficient role" in response.json()["detail"]


def test_rejects_invalid_jwt_claims(monkeypatch) -> None:
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(app_env="production"),
    )
    
    class MockSigningKey:
        key = "mock_key"

    class MockJWKClient:
        def __init__(self, *args, **kwargs):
            pass
        def get_signing_key_from_jwt(self, *args, **kwargs):
            return MockSigningKey()

    monkeypatch.setattr(security, "PyJWKClient", MockJWKClient)
    
    def mock_decode(token, key, **kwargs):
        raise jwt.InvalidTokenError("Invalid audience")
    monkeypatch.setattr(jwt, "decode", mock_decode)

    response = client.get(
        "/api/v1/reports/recent",
        headers={"Authorization": "Bearer invalid_token"},
    )

    assert response.status_code == 401
    assert "Invalid token signature or claims" in response.json()["detail"]


def test_sliding_window_limiter_resets_after_window() -> None:
    limiter = security.SlidingWindowLimiter()

    assert limiter.allow("client", limit=2, now=100) is True
    assert limiter.allow("client", limit=2, now=101) is True
    assert limiter.allow("client", limit=2, now=102) is False
    assert limiter.allow("client", limit=2, now=161) is True


def test_report_endpoint_returns_429_after_limit(monkeypatch) -> None:
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(limit=1),
    )
    security.report_limiter.clear()
    try:
        first = client.post("/api/v1/reports/analyze", data={})
        second = client.post("/api/v1/reports/analyze", data={})
    finally:
        security.report_limiter.clear()

    assert first.status_code == 422
    assert second.status_code == 429
    assert second.headers["retry-after"] == "60"


def test_cors_origins_are_trimmed_and_normalized() -> None:
    settings = Settings(
        enable_bigquery=False,
        cors_origins="https://one.example/, https://two.example",
    )

    assert settings.cors_origin_list == [
        "https://one.example",
        "https://two.example",
    ]
