import hashlib
import secrets
from datetime import datetime, timedelta, timezone


def issue_access_token(ttl_days: int = 365) -> tuple[str, str, datetime]:
    """Issue a one-time plaintext token with SHA-256 hash and expires_at (UTC)."""
    plaintext = secrets.token_urlsafe(32)
    token_hash = hash_access_token(plaintext)
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    return plaintext, token_hash, expires_at


def hash_access_token(plaintext: str) -> str:
    """SHA-256 hex digest matching issuance (hash-at-rest; never store plaintext)."""
    return hashlib.sha256(plaintext.encode()).hexdigest()


def token_binds_report(
    row: dict | None, report_id: str, now: datetime | None = None
) -> bool:
    """True only when row exists, report_id matches (constant-time), and not expired."""
    if row is None:
        return False
    bound_id = row.get("report_id")
    if not isinstance(bound_id, str) or not report_id:
        return False
    if not secrets.compare_digest(bound_id, report_id):
        return False
    expires_raw = row.get("expires_at")
    if expires_raw is None:
        return False
    if isinstance(expires_raw, datetime):
        expires_at = expires_raw
    else:
        text = str(expires_raw).replace("Z", "+00:00")
        try:
            expires_at = datetime.fromisoformat(text)
        except ValueError:
            return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    current = now if now is not None else datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    if expires_at <= current:
        return False
    return True
