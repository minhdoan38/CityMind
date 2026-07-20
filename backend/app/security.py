import secrets
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, Request

from app.config import get_settings


@dataclass(frozen=True)
class OfficerPrincipal:
    """Authenticated officer identity derived from a validated JWT."""

    token: str
    actor_id: str
    role: str


class SlidingWindowLimiter:
    def __init__(self):
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, now: float | None = None) -> bool:
        if limit <= 0:
            return True
        now = now if now is not None else time.monotonic()
        cutoff = now - 60
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            return True

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


report_limiter = SlidingWindowLimiter()


def require_officer(
    authorization: str | None = Header(default=None),
) -> OfficerPrincipal:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Officer authentication required")

    token = authorization.split(" ", 1)[1]
    settings = get_settings()

    if not settings.supabase_url:
        raise HTTPException(503, "Supabase service is not configured")

    try:
        # Determine JWKS URL
        jwks_url = settings.supabase_jwks_url
        if not jwks_url:
            jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/keys"

        # Determine expected issuer
        issuer = settings.supabase_jwt_issuer
        if not issuer:
            issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1"

        # Fetch keys and decode/validate JWT
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.supabase_jwt_audience,
            issuer=issuer,
        )

        actor_id = payload.get("sub")
        if not actor_id or not isinstance(actor_id, str):
            raise HTTPException(401, "Invalid token: missing subject")

        role = payload.get("app_metadata", {}).get("role")
        if role not in ("officer", "admin"):
            raise HTTPException(403, "Access forbidden: insufficient role")

        return OfficerPrincipal(token=token, actor_id=actor_id, role=role)

    except HTTPException:
        raise
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(401, f"Token expired: {exc}") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(401, f"Invalid token signature or claims: {exc}") from exc
    except Exception as exc:
        raise HTTPException(401, f"Authentication failed: {exc}") from exc


def client_ip(request: Request) -> str:
    """Trusted client hop for rate limiting (DATA-08 / D-19).

    Uses the Nth hop from the right of X-Forwarded-For where N is
    ``trusted_proxy_count`` (default 1 = rightmost / platform-appended hop).
    Leftmost client-supplied values alone cannot change the key when a
    platform hop is present.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        if hops:
            count = get_settings().trusted_proxy_count
            if count < 1:
                count = 1
            if count >= len(hops):
                return hops[0]
            return hops[-count]
    return request.client.host if request.client else "unknown"


def enforce_report_rate_limit(request: Request) -> None:
    limit = get_settings().report_rate_limit_per_minute
    if not report_limiter.allow(client_ip(request), limit):
        raise HTTPException(
            429,
            "Report submission rate limit exceeded",
            headers={"Retry-After": "60"},
        )
