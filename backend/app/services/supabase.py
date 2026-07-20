import json
from datetime import datetime, timezone
from collections import Counter
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from app.config import Settings


class SupabaseReportSink:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.enabled = bool(settings.supabase_url and settings.supabase_secret_key)
        
        if self.enabled:
            self.service_role_client = create_client(
                settings.supabase_url,
                settings.supabase_secret_key
            )
        else:
            self.service_role_client = None

    def get_client(self, caller_token: str | None = None) -> Client:
        if caller_token and self.settings.supabase_url:
            options = ClientOptions(headers={"Authorization": f"Bearer {caller_token}"})
            return create_client(
                self.settings.supabase_url,
                self.settings.supabase_publishable_key,
                options=options
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

        # Convert urban_context to dict if it is a JSON string, or keep dict
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

    def list_recent(
        self,
        limit: int = 20,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        min_severity: int | None = None,
        max_severity: int | None = None,
        caller_token: str | None = None,
    ) -> list[dict]:
        if not self.enabled:
            return []
        client = self.get_client(caller_token)
        query = client.table("reports").select("*, status_events(status, note, created_at)")
        
        if category is not None:
            query = query.eq("category", category)
        if priority is not None:
            query = query.eq("priority", priority)
        if min_severity is not None:
            query = query.gte("severity", min_severity)
        if max_severity is not None:
            query = query.lte("severity", max_severity)
            
        # We order by created_at of reports desc
        query = query.order("created_at", desc=True)
        response = query.execute()
        
        results = []
        for row in response.data:
            events = row.get("status_events", [])
            latest_event = None
            if events:
                sorted_events = sorted(events, key=lambda x: x.get("created_at", ""), reverse=True)
                latest_event = sorted_events[0]
                
            current_status = row.get("current_status")
            if not current_status:
                current_status = (
                    latest_event.get("status", "new") if latest_event else "new"
                )

            if status is not None and current_status != status:
                continue
                
            mapped = {
                "report_id": row["report_id"],
                "created_at": row["created_at"],
                "description": row["description"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "category": row["category"],
                "severity": row["severity"],
                "confidence": row["confidence"],
                "summary": row["summary"],
                "recommendation": row["recommendation"],
                "priority": row["priority"],
                "estimated_impact": row["estimated_impact"],
                "evidence": row["evidence"] or [],
                "uncertainty": row["uncertainty"] or [],
                "urban_context": row["urban_context"],
                "image_gcs_uri": row["image_gcs_uri"],
                "status": current_status,
                "status_note": latest_event.get("note") if latest_event else None,
            }
            results.append(mapped)
            if len(results) >= limit:
                break
        return results

    def summary(self, caller_token: str | None = None) -> dict:
        if not self.enabled:
            return {
                "total_reports": 0,
                "critical_reports": 0,
                "avg_severity": 0.0,
                "top_category": "none",
            }
        client = self.get_client(caller_token)
        response = client.table("reports").select("severity, priority, category").execute()
        rows = response.data
        if not rows:
            return {
                "total_reports": 0,
                "critical_reports": 0,
                "avg_severity": 0.0,
                "top_category": "none",
            }
        total_reports = len(rows)
        critical_reports = sum(1 for r in rows if r.get("priority") == "critical")
        avg_severity = round(sum(r.get("severity", 0) for r in rows) / total_reports, 2)
        
        categories = [r.get("category") for r in rows if r.get("category")]
        top_category = Counter(categories).most_common(1)[0][0] if categories else "none"
        
        return {
            "total_reports": total_reports,
            "critical_reports": critical_reports,
            "avg_severity": avg_severity,
            "top_category": top_category,
        }

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
        # Keep denormalized current_status in sync for SQL filter/sort (DATA-04/05).
        client.table("reports").update({"current_status": status}).eq(
            "report_id", report_id
        ).execute()
        return True

    def get_image_gcs_uri(self, report_id: str, caller_token: str | None = None) -> str | None:
        if not self.enabled:
            return None
        client = self.get_client(caller_token)
        response = client.table("reports").select("image_gcs_uri").eq("report_id", report_id).execute()
        if response.data:
            return response.data[0].get("image_gcs_uri")
        return None

    def get_report(self, report_id: str, caller_token: str | None = None) -> dict | None:
        if not self.enabled:
            return None
        client = self.get_client(caller_token)
        response = client.table("reports").select("*, status_events(status, note, created_at)").eq("report_id", report_id).execute()
        if not response.data:
            return None
        row = response.data[0]
        events = row.get("status_events", [])
        latest_event = None
        if events:
            sorted_events = sorted(events, key=lambda x: x.get("created_at", ""), reverse=True)
            latest_event = sorted_events[0]

        current_status = row.get("current_status")
        if not current_status:
            current_status = (
                latest_event.get("status", "new") if latest_event else "new"
            )

        return {
            "report_id": row["report_id"],
            "created_at": row["created_at"],
            "description": row["description"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "category": row["category"],
            "severity": row["severity"],
            "confidence": row["confidence"],
            "summary": row["summary"],
            "recommendation": row["recommendation"],
            "priority": row["priority"],
            "estimated_impact": row["estimated_impact"],
            "evidence": row["evidence"] or [],
            "uncertainty": row["uncertainty"] or [],
            "urban_context": row["urban_context"],
            "image_gcs_uri": row["image_gcs_uri"],
            "status": current_status,
            "status_note": latest_event.get("note") if latest_event else None,
            "status_updated_at": latest_event.get("created_at") if latest_event else None,
        }

    def status_history(self, report_id: str, caller_token: str | None = None) -> list[dict]:
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

    def insert_access_token(self, report_id: str, token_hash: str, expires_at: datetime) -> bool:
        if not self.enabled:
            return False
        row = {
            "token_hash": token_hash,
            "report_id": report_id,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        client = self.get_client()
        client.table("access_tokens").insert(row).execute()
        return True
