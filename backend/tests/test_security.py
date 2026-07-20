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


def security_settings(
    url="https://project.supabase.co",
    app_env="development",
    limit=0,
    status_limit=0,
    trusted_proxy_count=1,
):
    return SimpleNamespace(
        supabase_url=url,
        supabase_publishable_key="pubkey",
        supabase_secret_key="seckey",
        supabase_jwt_audience="authenticated",
        supabase_jwt_issuer="",
        supabase_jwks_url="",
        app_env=app_env,
        report_rate_limit_per_minute=limit,
        status_rate_limit_per_minute=status_limit,
        trusted_proxy_count=trusted_proxy_count,
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
            "sub": "officer-jwt-sub",
            "aud": "authenticated",
            "iss": "https://project.supabase.co/auth/v1",
            "app_metadata": {"role": "officer"},
            "exp": 9999999999
        }
    monkeypatch.setattr(jwt, "decode", mock_decode)
    
    monkeypatch.setattr(
        reports_api,
        "get_sink",
        lambda: SimpleNamespace(list_recent=lambda *_args, **_kwargs: ([], None)),
    )

    # Bypass autouse Principal override so real require_officer runs
    app.dependency_overrides.pop(security.require_officer, None)

    response = client.get(
        "/api/v1/reports/recent",
        headers={"Authorization": "Bearer valid_token"},
    )

    assert response.status_code == 200


def test_require_officer_returns_principal_with_jwt_sub(monkeypatch) -> None:
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
            "sub": "actor-from-jwt",
            "aud": "authenticated",
            "iss": "https://project.supabase.co/auth/v1",
            "app_metadata": {"role": "admin"},
            "exp": 9999999999,
        }

    monkeypatch.setattr(jwt, "decode", mock_decode)

    principal = security.require_officer(authorization="Bearer valid_token")
    assert isinstance(principal, security.OfficerPrincipal)
    assert principal.token == "valid_token"
    assert principal.actor_id == "actor-from-jwt"
    assert principal.role == "admin"


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
            "sub": "citizen-sub",
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

def test_xff_rate_limiter_uses_rightmost_hop(monkeypatch):
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(limit=1),
    )
    security.report_limiter.clear()

    class MockRequest:
        def __init__(self, headers):
            self.headers = headers
            self.client = SimpleNamespace(host="127.0.0.1")

    allowed_keys = []

    def mock_allow(key, limit, now=None):
        allowed_keys.append(key)
        return True

    monkeypatch.setattr(security.report_limiter, "allow", mock_allow)

    # Leftmost spoof must not become the key when a platform hop is present.
    req1 = MockRequest({"x-forwarded-for": "10.0.0.1, 192.168.1.1"})
    security.enforce_report_rate_limit(req1)

    req2 = MockRequest({"x-forwarded-for": "1.2.3.4"})
    security.enforce_report_rate_limit(req2)

    req3 = MockRequest({})
    security.enforce_report_rate_limit(req3)

    assert allowed_keys == ["192.168.1.1", "1.2.3.4", "127.0.0.1"]


def test_xff_trusted_proxy_count_peels_rightmost(monkeypatch):
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(limit=0, trusted_proxy_count=2),
    )
    security.report_limiter.clear()

    class MockRequest:
        def __init__(self, headers):
            self.headers = headers
            self.client = SimpleNamespace(host="127.0.0.1")

    allowed_keys = []

    def mock_allow(key, limit, now=None):
        allowed_keys.append(key)
        return True

    monkeypatch.setattr(security.report_limiter, "allow", mock_allow)

    # spoof, client, cloud-run, extra-lb — count=2 selects 2nd from right (cloud-run)
    req = MockRequest({"x-forwarded-for": "9.9.9.9, 203.0.113.10, 10.0.0.1, 10.0.0.2"})
    security.enforce_report_rate_limit(req)

    assert allowed_keys == ["10.0.0.1"]
    # Leftmost spoof is ignored when trusted hops are present
    assert "9.9.9.9" not in allowed_keys


def test_status_rate_limiter_uses_status_prefix_and_xff(monkeypatch):
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(status_limit=1),
    )
    security.status_limiter.clear()
    security.report_limiter.clear()

    class MockRequest:
        def __init__(self, headers):
            self.headers = headers
            self.client = SimpleNamespace(host="127.0.0.1")

    allowed_keys = []

    def mock_allow(key, limit, now=None):
        allowed_keys.append(key)
        return True

    monkeypatch.setattr(security.status_limiter, "allow", mock_allow)

    req = MockRequest({"x-forwarded-for": "10.0.0.1, 192.168.1.1"})
    security.enforce_status_rate_limit(req)

    assert allowed_keys == ["status:192.168.1.1"]
    assert len(security.report_limiter._events) == 0


def test_status_and_report_limiters_do_not_share_events(monkeypatch):
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(limit=1, status_limit=1),
    )
    security.report_limiter.clear()
    security.status_limiter.clear()

    class MockRequest:
        def __init__(self, headers):
            self.headers = headers
            self.client = SimpleNamespace(host="127.0.0.1")

    req = MockRequest({"x-forwarded-for": "203.0.113.9"})
    security.enforce_report_rate_limit(req)
    security.enforce_status_rate_limit(req)

    assert "203.0.113.9" in security.report_limiter._events
    assert "status:203.0.113.9" in security.status_limiter._events
    assert "status:203.0.113.9" not in security.report_limiter._events
    assert "203.0.113.9" not in security.status_limiter._events
