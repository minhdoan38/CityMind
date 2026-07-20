import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.config import Settings  # noqa: E402
from app.demo_data import (  # noqa: E402
    REPORTS,
    STATUS_EVENTS,
    build_report_rows,
    build_status_rows,
    demo_evidence_png,
    demo_summary,
)
from app.services.storage import EvidenceStorage  # noqa: E402
from supabase import create_client


def parse_args():
    parser = argparse.ArgumentParser(description="Seed deterministic CityMind demo data to Supabase.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write missing demo rows to Supabase and one image to private Storage.",
    )
    return parser.parse_args()


def apply_seed(settings):
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise RuntimeError("Supabase credentials must be configured")
    if not settings.enable_image_storage:
        raise RuntimeError("Private image storage must be enabled and configured")

    client = create_client(settings.supabase_url, settings.supabase_secret_key)
    
    # Check existing reports
    response = client.table("reports").select("report_id").execute()
    existing_reports = {row["report_id"] for row in response.data}
    missing_reports = [r for r in REPORTS if r.report_id not in existing_reports]

    image_report = next(report for report in REPORTS if report.has_image)
    image_uri = None
    if image_report.report_id in {r.report_id for r in missing_reports}:
        image_uri = EvidenceStorage(settings).upload_image(
            image_report.report_id,
            demo_evidence_png(),
            "image/png",
        )

    now = datetime.now(timezone.utc)
    report_rows = []
    
    # Build report rows using the demo data generator
    raw_rows = build_report_rows(now, image_uri=image_uri)
    for row in raw_rows:
        if row["report_id"] in existing_reports:
            continue
            
        # Parse serialized string fields if they were built as strings
        urban_context = row["urban_context"]
        if isinstance(urban_context, str):
            try:
                urban_context = json.loads(urban_context)
            except Exception:
                urban_context = {"raw": urban_context}

        evidence = row.get("evidence", [])
        if isinstance(evidence, str):
            try:
                evidence = json.loads(evidence)
            except Exception:
                evidence = [evidence]

        uncertainty = row.get("uncertainty", [])
        if isinstance(uncertainty, str):
            try:
                uncertainty = json.loads(uncertainty)
            except Exception:
                uncertainty = [uncertainty]

        mapped = {
            "report_id": row["report_id"],
            "created_at": row["created_at"],
            "description": row["description"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "urban_context": urban_context,
            "image_gcs_uri": row["image_gcs_uri"],
            "category": row.get("category"),
            "severity": row.get("severity"),
            "confidence": row.get("confidence"),
            "summary": row.get("summary"),
            "recommendation": row.get("recommendation"),
            "priority": row.get("priority"),
            "estimated_impact": row.get("estimated_impact"),
            "evidence": evidence,
            "uncertainty": uncertainty,
        }
        report_rows.append(mapped)

    if report_rows:
        client.table("reports").insert(report_rows).execute()

    # Fetch existing status events
    response = client.table("status_events").select("report_id, status, note").execute()
    existing_statuses = {
        (row["report_id"], row["status"], row.get("note"))
        for row in response.data
    }

    status_rows = [
        row
        for row in build_status_rows(now)
        if (row["report_id"], row["status"], row.get("note")) not in existing_statuses
    ]
    if status_rows:
        client.table("status_events").insert(status_rows).execute()

    return {
        "reports_inserted": len(report_rows),
        "reports_skipped": len(existing_reports),
        "status_events_inserted": len(status_rows),
        "image_uploaded": image_uri is not None,
    }


def main():
    args = parse_args()
    print(json.dumps(demo_summary(), indent=2, sort_keys=True))
    if not args.apply:
        print("Dry run only. Use --apply to write demo data.")
        return 0

    result = apply_seed(Settings())
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
