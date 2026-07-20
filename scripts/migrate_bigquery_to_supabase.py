import argparse
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.config import Settings  # noqa: E402
from google.cloud import bigquery
from supabase import create_client


def parse_args():
    parser = argparse.ArgumentParser(description="Migrate BigQuery reports & status events to Supabase.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform the migration and write data to Supabase.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Reconcile source and target counts/IDs.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show counts of source records without writing to Supabase.",
    )
    return parser.parse_args()


def fetch_bigquery_data(settings):
    bq_client = bigquery.Client(project=settings.google_cloud_project)
    
    reports_table = f"{settings.google_cloud_project}.{settings.bigquery_dataset}.{settings.bigquery_reports_table}"
    events_table = f"{settings.google_cloud_project}.{settings.bigquery_dataset}.report_status_events"

    # Fetch reports
    reports_query = f"SELECT * FROM `{reports_table}`"
    reports_rows = [dict(row) for row in bq_client.query(reports_query).result()]

    # Fetch events
    events_query = f"SELECT * FROM `{events_table}`"
    events_rows = [dict(row) for row in bq_client.query(events_query).result()]

    return reports_rows, events_rows


def migrate(settings, apply=False, dry_run=False, verify=False):
    reports, events = fetch_bigquery_data(settings)

    print(f"Source BigQuery Reports: {len(reports)}")
    print(f"Source BigQuery Status Events: {len(events)}")

    if dry_run:
        print("Dry run complete. No modifications made to Supabase.")
        return 0

    if not apply and not verify:
        print("Use --apply to write data, --dry-run for a dry run, or --verify to run reconciliation.")
        return 0

    sb_client = create_client(settings.supabase_url, settings.supabase_secret_key)

    if apply:
        # Check existing target reports/events
        response = sb_client.table("reports").select("report_id").execute()
        existing_report_ids = {r["report_id"] for r in response.data}

        response = sb_client.table("status_events").select("report_id, status, note, created_at").execute()
        existing_events = {
            (e["report_id"], e["status"], e.get("note"), e["created_at"])
            for e in response.data
        }

        # Insert missing reports
        reports_to_insert = []
        for r in reports:
            if r["report_id"] in existing_report_ids:
                continue

            # Convert JSON structures if stored as strings
            urban_context = r.get("urban_context")
            if isinstance(urban_context, str):
                try:
                    urban_context = json.loads(urban_context)
                except Exception:
                    urban_context = {"raw": urban_context}

            evidence = r.get("evidence", [])
            if isinstance(evidence, str):
                try:
                    evidence = json.loads(evidence)
                except Exception:
                    evidence = [evidence]

            uncertainty = r.get("uncertainty", [])
            if isinstance(uncertainty, str):
                try:
                    uncertainty = json.loads(uncertainty)
                except Exception:
                    uncertainty = [uncertainty]

            reports_to_insert.append({
                "report_id": r["report_id"],
                "created_at": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else r["created_at"],
                "description": r.get("description"),
                "latitude": r.get("latitude"),
                "longitude": r.get("longitude"),
                "category": r.get("category"),
                "severity": r.get("severity"),
                "confidence": r.get("confidence"),
                "summary": r.get("summary"),
                "recommendation": r.get("recommendation"),
                "priority": r.get("priority"),
                "estimated_impact": r.get("estimated_impact"),
                "evidence": evidence,
                "uncertainty": uncertainty,
                "urban_context": urban_context,
                "image_gcs_uri": r.get("image_gcs_uri"),
            })

        if reports_to_insert:
            sb_client.table("reports").insert(reports_to_insert).execute()
            print(f"Successfully inserted {len(reports_to_insert)} new reports into Supabase.")
        else:
            print("No new reports to insert.")

        # Insert missing status events
        events_to_insert = []
        for e in events:
            created_at_str = e["created_at"].isoformat() if hasattr(e["created_at"], "isoformat") else e["created_at"]
            if (e["report_id"], e["status"], e.get("note"), created_at_str) in existing_events:
                continue

            events_to_insert.append({
                "report_id": e["report_id"],
                "status": e["status"],
                "note": e.get("note"),
                "created_at": created_at_str,
            })

        if events_to_insert:
            sb_client.table("status_events").insert(events_to_insert).execute()
            print(f"Successfully inserted {len(events_to_insert)} new status events into Supabase.")
        else:
            print("No new status events to insert.")

    if verify:
        # Reconciliation check
        print("\n--- Running Reconciliation ---")
        sb_reports = sb_client.table("reports").select("report_id").execute().data
        sb_events = sb_client.table("status_events").select("report_id, status").execute().data

        src_report_ids = {r["report_id"] for r in reports}
        tgt_report_ids = {r["report_id"] for r in sb_reports}

        missing_ids = src_report_ids - tgt_report_ids

        print(f"Supabase Reports count: {len(sb_reports)} (BigQuery: {len(reports)})")
        print(f"Supabase Status Events count: {len(sb_events)} (BigQuery: {len(events)})")

        if len(sb_reports) < len(reports):
            print(f"ERROR: Reconciliation failed! Supabase contains fewer reports. Missing IDs: {missing_ids}")
            return 1
        if len(sb_events) < len(events):
            print("ERROR: Reconciliation failed! Supabase contains fewer status events.")
            return 1

        print("Reconciliation successful: all source records exist in target database.")
    
    return 0


def main():
    args = parse_args()
    settings = Settings()
    return migrate(settings, apply=args.apply, dry_run=args.dry_run, verify=args.verify)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        sys.exit(1)
