import base64
import json
from collections import Counter
from collections.abc import Iterator
from datetime import datetime, timezone

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from app.config import Settings

# Soft export row cap for Cloud Run memory/time (RESEARCH A3).
EXPORT_SOFT_ROW_CAP = 10_000

SORT_COLUMNS = {
    "created_at": "created_at",
    "priority": "priority",
    "status": "current_status",
    "category": "category",
}


def encode_cursor(sort: str, order: str, value: str, report_id: str) -> str:
    raw = f"{sort}:{order}:{value}:{report_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[str, str, str, str]:
    pad = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(cursor + pad).decode("utf-8")
    parts = raw.split(":", 3)
    if len(parts) != 4:
        raise ValueError("Invalid cursor")
    return parts[0], parts[1], parts[2], parts[3]


class SupabaseReportSink:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.enabled = bool(settings.supabase_url and settings.supabase_secret_key)

        if self.enabled:
            self.service_role_client = create_client(
                settings.supabase_url,
                settings.supabase_secret_key,
            )
        else:
            self.service_role_client = None

    def get_client(self, caller_token: str | None = None) -> Client:
        if caller_token and self.settings.supabase_url:
            options = ClientOptions(headers={"Authorization": f"Bearer {caller_token}"})
            return create_client(
                self.settings.supabase_url,
                self.settings.supabase_publishable_key,
                options=options,
            )
        if self.service_role_client is None:
            raise RuntimeError("Supabase client is not configured (missing URL or keys)")
        return self.service_role_client

    def insert(
        self,
        report_id: str,
        description: str,
        latitude: float | None,
        longitude: float | None,
        analysis,
        urban_context: str | dict | None = None,
        image_gcs_uri: str | None = None,
    ) -> bool:
        if not self.enabled:
            return False

        context_data = urban_context
        if isinstance(urban_context, str):
            try:
                context_data = json.loads(urban_context)
            except Exception:
                context_data = {"raw": urban_context}

        analysis_dict = analysis.model_dump(mode="json")

        row = {
            "report_id": report_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "description": description,
            "latitude": latitude,
            "longitude": longitude,
            "urban_context": context_data,
            "image_gcs_uri": image_gcs_uri,
            "category": analysis_dict.get("category"),
            "severity": analysis_dict.get("severity"),
            "confidence": analysis_dict.get("confidence"),
            "summary": analysis_dict.get("summary"),
            "recommendation": analysis_dict.get("recommendation"),
            "priority": analysis_dict.get("priority"),
            "estimated_impact": analysis_dict.get("estimated_impact"),
            "evidence": analysis_dict.get("evidence", []),
            "uncertainty": analysis_dict.get("uncertainty", []),
            "current_status": "new",
        }

        client = self.get_client()
        client.table("reports").insert(row).execute()
        return True

    def _apply_filters(
        self,
        query,
        *,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        min_severity: int | None = None,
        max_severity: int | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
    ):
        if status is not None:
            query = query.eq("current_status", status)
        if category is not None:
            query = query.eq("category", category)
        if priority is not None:
            query = query.eq("priority", priority)
        if min_severity is not None:
            query = query.gte("severity", min_severity)
        if max_severity is not None:
            query = query.lte("severity", max_severity)
        if created_after is not None:
            query = query.gte("created_at", created_after)
        if created_before is not None:
            query = query.lte("created_at", created_before)
        return query

    def _map_report_row(self, row: dict) -> dict:
        events = row.get("status_events", []) or []
        latest_event = None
        if events:
            sorted_events = sorted(
                events, key=lambda x: x.get("created_at", ""), reverse=True
            )
            latest_event = sorted_events[0]

        current_status = row.get("current_status")
        if not current_status:
            current_status = (
                latest_event.get("status", "new") if latest_event else "new"
            )

        return {
            "report_id": row["report_id"],
            "created_at": row["created_at"],
            "description": row.get("description"),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "category": row.get("category"),
            "severity": row.get("severity"),
            "confidence": row.get("confidence"),
            "summary": row.get("summary"),
            "recommendation": row.get("recommendation"),
            "priority": row.get("priority"),
            "estimated_impact": row.get("estimated_impact"),
            "evidence": row.get("evidence") or [],
            "uncertainty": row.get("uncertainty") or [],
            "urban_context": row.get("urban_context"),
            "image_gcs_uri": row.get("image_gcs_uri"),
            "status": current_status,
            "status_note": latest_event.get("note") if latest_event else None,
        }

    def _apply_keyset(
        self,
        query,
        *,
        sort: str,
        order: str,
        cursor: str | None,
    ):
        column = SORT_COLUMNS[sort]
        descending = order == "desc"
        query = query.order(column, desc=descending).order(
            "report_id", desc=descending
        )
        if not cursor:
            return query

        cursor_sort, cursor_order, value, report_id = decode_cursor(cursor)
        if cursor_sort != sort or cursor_order != order:
            raise ValueError("Cursor does not match sort/order")

        if descending:
            query = query.or_(
                f"{column}.lt.{value},and({column}.eq.{value},report_id.lt.{report_id})"
            )
        else:
            query = query.or_(
                f"{column}.gt.{value},and({column}.eq.{value},report_id.gt.{report_id})"
            )
        return query

    def list_recent(
        self,
        limit: int = 25,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        min_severity: int | None = None,
        max_severity: int | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        cursor: str | None = None,
        sort: str = "created_at",
        order: str = "desc",
        caller_token: str | None = None,
    ) -> tuple[list[dict], str | None]:
        if not self.enabled:
            return [], None
        if sort not in SORT_COLUMNS:
            raise ValueError(f"Unsupported sort: {sort}")
        if order not in {"asc", "desc"}:
            raise ValueError(f"Unsupported order: {order}")

        client = self.get_client(caller_token)
        query = client.table("reports").select(
            "*, status_events(status, note, created_at)"
        )
        query = self._apply_filters(
            query,
            status=status,
            category=category,
            priority=priority,
            min_severity=min_severity,
            max_severity=max_severity,
            created_after=created_after,
            created_before=created_before,
        )
        query = self._apply_keyset(query, sort=sort, order=order, cursor=cursor)
        query = query.limit(limit + 1)
        response = query.execute()

        rows = response.data or []
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        items = [self._map_report_row(row) for row in page_rows]

        next_cursor = None
        if has_more and page_rows:
            last = page_rows[-1]
            column = SORT_COLUMNS[sort]
            sort_value = last.get(column)
            if sort == "status":
                sort_value = last.get("current_status") or items[-1]["status"]
            next_cursor = encode_cursor(
                sort, order, str(sort_value), last["report_id"]
            )
        return items, next_cursor

    def summary(
        self,
        caller_token: str | None = None,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        min_severity: int | None = None,
        max_severity: int | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
    ) -> dict:
        empty = {
            "total_reports": 0,
            "critical_reports": 0,
            "avg_severity": 0.0,
            "top_category": "none",
        }
        if not self.enabled:
            return empty
        client = self.get_client(caller_token)
        query = client.table("reports").select(
            "severity, priority, category, current_status"
        )
        query = self._apply_filters(
            query,
            status=status,
            category=category,
            priority=priority,
            min_severity=min_severity,
            max_severity=max_severity,
            created_after=created_after,
            created_before=created_before,
        )
        response = query.execute()
        rows = response.data or []
        if not rows:
            return empty
        total_reports = len(rows)
        critical_reports = sum(1 for r in rows if r.get("priority") == "critical")
        avg_severity = round(
            sum(r.get("severity", 0) or 0 for r in rows) / total_reports, 2
        )
        categories = [r.get("category") for r in rows if r.get("category")]
        top_category = (
            Counter(categories).most_common(1)[0][0] if categories else "none"
        )
        return {
            "total_reports": total_reports,
            "critical_reports": critical_reports,
            "avg_severity": avg_severity,
            "top_category": top_category,
        }

    def iter_filtered(
        self,
        *,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        min_severity: int | None = None,
        max_severity: int | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        caller_token: str | None = None,
        page_size: int = 100,
        soft_cap: int = EXPORT_SOFT_ROW_CAP,
    ) -> Iterator[dict]:
        """Yield filtered report rows via keyset pages (never materialize all rows)."""
        if not self.enabled:
            return
        cursor = None
        yielded = 0
        while yielded < soft_cap:
            batch_limit = min(page_size, soft_cap - yielded)
            items, next_cursor = self.list_recent(
                limit=batch_limit,
                status=status,
                category=category,
                priority=priority,
                min_severity=min_severity,
                max_severity=max_severity,
                created_after=created_after,
                created_before=created_before,
                cursor=cursor,
                sort="created_at",
                order="desc",
                caller_token=caller_token,
            )
            if not items:
                break
            for item in items:
                yield item
                yielded += 1
                if yielded >= soft_cap:
                    return
            if not next_cursor:
                break
            cursor = next_cursor

    def update_status(
        self,
        report_id: str,
        status: str,
        note: str | None = None,
        actor_id: str | None = None,
        caller_token: str | None = None,
    ) -> bool:
        if not self.enabled:
            return False
        client = self.get_client(caller_token)
        row = {
            "report_id": report_id,
            "status": status,
            "note": note,
            "actor_id": actor_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        client.table("status_events").insert(row).execute()
        client.table("reports").update({"current_status": status}).eq(
            "report_id", report_id
        ).execute()
        return True

    def get_image_gcs_uri(
        self, report_id: str, caller_token: str | None = None
    ) -> str | None:
        if not self.enabled:
            return None
        client = self.get_client(caller_token)
        response = (
            client.table("reports")
            .select("image_gcs_uri")
            .eq("report_id", report_id)
            .execute()
        )
        if response.data:
            return response.data[0].get("image_gcs_uri")
        return None

    def get_report(
        self, report_id: str, caller_token: str | None = None
    ) -> dict | None:
        if not self.enabled:
            return None
        client = self.get_client(caller_token)
        response = (
            client.table("reports")
            .select("*, status_events(status, note, created_at)")
            .eq("report_id", report_id)
            .execute()
        )
        if not response.data:
            return None
        row = response.data[0]
        mapped = self._map_report_row(row)
        events = row.get("status_events", []) or []
        latest_event = None
        if events:
            latest_event = sorted(
                events, key=lambda x: x.get("created_at", ""), reverse=True
            )[0]
        mapped["status_updated_at"] = (
            latest_event.get("created_at") if latest_event else None
        )
        return mapped

    def status_history(
        self, report_id: str, caller_token: str | None = None
    ) -> list[dict]:
        if not self.enabled:
            return []
        client = self.get_client(caller_token)
        response = (
            client.table("status_events")
            .select("status, note, actor_id, created_at")
            .eq("report_id", report_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    def insert_access_token(
        self, report_id: str, token_hash: str, expires_at: datetime
    ) -> bool:
        if not self.enabled:
            return False
        row = {
            "token_hash": token_hash,
            "report_id": report_id,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        client = self.get_client()
        client.table("access_tokens").insert(row).execute()
        return True

    def get_access_token_by_hash(self, token_hash: str) -> dict | None:
        """Service-role lookup by token_hash PK (no plaintext; no report_id-first scan)."""
        if not self.enabled:
            return None
        client = self.get_client()
        response = (
            client.table("access_tokens")
            .select("token_hash, report_id, expires_at")
            .eq("token_hash", token_hash)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]

    def get_citizen_status(self, report_id: str) -> dict | None:
        """Citizen-safe projection: status, summary, history without actor_id (CIT-02)."""
        if not self.enabled:
            return None
        client = self.get_client()
        report_response = (
            client.table("reports")
            .select("report_id, summary, current_status")
            .eq("report_id", report_id)
            .limit(1)
            .execute()
        )
        if not report_response.data:
            return None
        row = report_response.data[0]
        events_response = (
            client.table("status_events")
            .select("status, note, created_at")
            .eq("report_id", report_id)
            .order("created_at", desc=True)
            .execute()
        )
        history = [
            {
                "status": event.get("status"),
                "note": event.get("note"),
                "created_at": event.get("created_at"),
            }
            for event in (events_response.data or [])
        ]
        return {
            "status": row.get("current_status") or "new",
            "summary": row.get("summary"),
            "history": history,
        }
