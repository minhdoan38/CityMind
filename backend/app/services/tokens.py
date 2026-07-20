import hashlib
import secrets
from datetime import datetime, timedelta, timezone


def issue_access_token(ttl_days: int = 365) -> tuple[str, str, datetime]:
    """Issue a one-time plaintext token with SHA-256 hash and expires_at (UTC)."""
    plaintext = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    return plaintext, token_hash, expires_at
