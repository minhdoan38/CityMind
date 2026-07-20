import csv
import io
import logging
import os
import tempfile
from collections.abc import Iterator
from functools import lru_cache
from typing import Union
from uuid import uuid4

import filetype
import xlsxwriter
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.schemas import (
    AnalyzeResponse,
    Category,
    CitizenStatusRequest,
    CitizenStatusResponse,
    Priority,
)
from app.security import (
    OfficerPrincipal,
    enforce_report_rate_limit,
    enforce_status_rate_limit,
    require_officer,
)
from app.services.context_data import UrbanContextService
from app.services.gemini import GeminiAnalyzer
from app.services.storage import EvidenceStorage
from app.services.supabase import EXPORT_SOFT_ROW_CAP, SORT_COLUMNS, SupabaseReportSink, parse_bbox
from app.services.tokens import hash_access_token, issue_access_token, token_binds_report

VALID_STATUSES = {"new", "reviewing", "resolved", "rejected"}
VALID_CATEGORIES = {category.value for category in Category}
VALID_PRIORITIES = {priority.value for priority in Priority}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
EXPORT_FIELDS = [
    "report_id",
    "created_at",
    "category",
    "priority",
    "status",
    "summary",
    "severity",
    "recommendation",
    "status_note",
]
XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)
# CIT-03 / D-16 — identical detail for all citizen verify failures (never 404).
CITIZEN_STATUS_UNAUTHORIZED_DETAIL = "We could not verify that report and token."

router = APIRouter()


def _citizen_status_unauthorized() -> HTTPException:
    return HTTPException(401, CITIZEN_STATUS_UNAUTHORIZED_DETAIL)


@lru_cache
def get_analyzer() -> GeminiAnalyzer:
    return GeminiAnalyzer(get_settings())


@lru_cache
def get_sink() -> SupabaseReportSink:
    return SupabaseReportSink(get_settings())


@lru_cache
def get_context_service() -> UrbanContextService:
    return UrbanContextService()


@lru_cache
def get_evidence_storage() -> EvidenceStorage:
    return EvidenceStorage(get_settings())


def _validate_report_filters(
    *,
    status: str | None,
    category: str | None,
    priority: str | None,
    min_severity: int | None,
    max_severity: int | None,
) -> None:
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(422, "Invalid status filter")
    if category is not None and category not in VALID_CATEGORIES:
        raise HTTPException(422, "Invalid category filter")
    if priority is not None and priority not in VALID_PRIORITIES:
        raise HTTPException(422, "Invalid priority filter")
    if (
        min_severity is not None
        and max_severity is not None
        and min_severity > max_severity
    ):
        raise HTTPException(422, "min_severity cannot exceed max_severity")


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_report(
    description: str = Form(default="", max_length=3000),
    latitude: float | None = Form(default=None, ge=-90, le=90),
    longitude: float | None = Form(default=None, ge=-180, le=180),
    image: Union[UploadFile, str, None] = File(default=None),
    _rate_limit: None = Depends(enforce_report_rate_limit),
) -> AnalyzeResponse:
    if isinstance(image, str) or (image is not None and not image.filename):
        image = None

    image_bytes = None
    mime_type = None
    if image is not None:
        image_bytes = await image.read()

        if not image_bytes:
            image_bytes = None
        else:
            kind = filetype.guess(image_bytes)
            if kind is None or kind.mime not in ALLOWED_IMAGE_TYPES:
                raise HTTPException(
                    415,
                    f"Only JPEG, PNG, or WebP images are accepted. Received: {kind.mime if kind else 'unknown'}",
                )
            mime_type = kind.mime
            if len(image_bytes) > get_settings().max_image_bytes:
                raise HTTPException(413, "Image exceeds configured size limit")

    if not description.strip() and image_bytes is None:
        raise HTTPException(422, "Provide description or image")

    report_id = str(uuid4())
    try:
        image_gcs_uri = get_evidence_storage().upload_image(
            report_id, image_bytes, mime_type
        )
        urban_context = get_context_service().get_context(latitude, longitude)

        enriched_description = description.strip()
        if urban_context:
            enriched_description += f"\n\nUrban context:\n{urban_context}"

        analysis = get_analyzer().analyze(
            enriched_description, image_bytes, mime_type
        )
        persisted = get_sink().insert(
            report_id,
            description.strip(),
            latitude,
            longitude,
            analysis,
            urban_context=urban_context,
            image_gcs_uri=image_gcs_uri,
        )
        access_token = None
        if persisted:
            plaintext, token_hash, expires_at = issue_access_token()
            get_sink().insert_access_token(report_id, token_hash, expires_at)
            access_token = plaintext
    except Exception as exc:
        logging.exception("Report analysis failed")
        raise HTTPException(502, "Report analysis failed") from exc

    return AnalyzeResponse(
        report_id=report_id,
        analysis=analysis,
        persisted=persisted,
        access_token=access_token,
    )


@router.post("/status", response_model=CitizenStatusResponse)
async def citizen_report_status(
    body: CitizenStatusRequest,
    _rate_limit: None = Depends(enforce_status_rate_limit),
) -> CitizenStatusResponse:
    """Public citizen status lookup — token proof only; uniform 401 on any verify miss."""
    token_hash = hash_access_token(body.token)
    try:
        sink = get_sink()
        row = sink.get_access_token_by_hash(token_hash)
        if not token_binds_report(row, body.report_id):
            raise _citizen_status_unauthorized()
        payload = sink.get_citizen_status(body.report_id)
        if not payload:
            raise _citizen_status_unauthorized()
        return CitizenStatusResponse(
            status=payload["status"],
            summary=payload.get("summary"),
            history=payload.get("history") or [],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Citizen status lookup failed")
        raise HTTPException(502, "Status lookup failed") from exc


@router.get("/recent")
async def recent_reports(
    limit: int = 25,
    cursor: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    min_severity: int | None = Query(default=None, ge=1, le=5),
    max_severity: int | None = Query(default=None, ge=1, le=5),
    created_after: str | None = None,
    created_before: str | None = None,
    officer: OfficerPrincipal = Depends(require_officer),
):
    if limit < 1 or limit > 100:
        raise HTTPException(422, "limit must be between 1 and 100")
    if sort not in SORT_COLUMNS:
        raise HTTPException(422, "Invalid sort")
    if order not in {"asc", "desc"}:
        raise HTTPException(422, "Invalid order")
    _validate_report_filters(
        status=status,
        category=category,
        priority=priority,
        min_severity=min_severity,
        max_severity=max_severity,
    )

    try:
        items, next_cursor = get_sink().list_recent(
            limit,
            status=status,
            category=category,
            priority=priority,
            min_severity=min_severity,
            max_severity=max_severity,
            created_after=created_after,
            created_before=created_before,
            cursor=cursor,
            sort=sort,
            order=order,
            caller_token=officer.token,
        )
        return {
            "items": items,
            "count": len(items),
            "next_cursor": next_cursor,
            "sort": sort,
            "order": order,
        }
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Database query failed: {exc}") from exc


@router.get("/summary")
async def reports_summary(
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    min_severity: int | None = Query(default=None, ge=1, le=5),
    max_severity: int | None = Query(default=None, ge=1, le=5),
    created_after: str | None = None,
    created_before: str | None = None,
    bbox: str | None = None,
    officer: OfficerPrincipal = Depends(require_officer),
):
    _validate_report_filters(
        status=status,
        category=category,
        priority=priority,
        min_severity=min_severity,
        max_severity=max_severity,
    )
    if bbox:
        try:
            parse_bbox(bbox)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    try:
        return get_sink().summary(
            caller_token=officer.token,
            status=status,
            category=category,
            priority=priority,
            min_severity=min_severity,
            max_severity=max_severity,
            created_after=created_after,
            created_before=created_before,
            bbox=bbox,
        )
    except Exception as exc:
        raise HTTPException(502, f"Database summary failed: {exc}") from exc


@router.get("/geo/pins")
async def geo_pins(
    west: float = Query(..., ge=-180, le=180),
    south: float = Query(..., ge=-90, le=90),
    east: float = Query(..., ge=-180, le=180),
    north: float = Query(..., ge=-90, le=90),
    filter_bbox: str | None = Query(default=None),
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    min_severity: int | None = Query(default=None, ge=1, le=5),
    max_severity: int | None = Query(default=None, ge=1, le=5),
    created_after: str | None = None,
    created_before: str | None = None,
    officer: OfficerPrincipal = Depends(require_officer),
):
    if west >= east or south >= north:
        raise HTTPException(
            422,
            "Enter a valid bounding box (west < east; latitude between -90 and 90).",
        )
    _validate_report_filters(
        status=status,
        category=category,
        priority=priority,
        min_severity=min_severity,
        max_severity=max_severity,
    )
    filter_west = filter_south = filter_east = filter_north = None
    if filter_bbox:
        try:
            filter_west, filter_south, filter_east, filter_north = parse_bbox(filter_bbox)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    try:
        pins, unlocated_count = get_sink().list_geo_pins(
            west=west,
            south=south,
            east=east,
            north=north,
            filter_west=filter_west,
            filter_south=filter_south,
            filter_east=filter_east,
            filter_north=filter_north,
            status=status,
            category=category,
            priority=priority,
            min_severity=min_severity,
            max_severity=max_severity,
            created_after=created_after,
            created_before=created_before,
            caller_token=officer.token,
        )
        return {"pins": pins, "unlocated_count": unlocated_count}
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Geo pins query failed: {exc}") from exc


def _csv_iter(rows: Iterator[dict]) -> Iterator[str]:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=EXPORT_FIELDS, extrasaction="ignore")
    writer.writeheader()
    yield buf.getvalue()
    buf.seek(0)
    buf.truncate(0)
    for row in rows:
        writer.writerow({key: row.get(key) for key in EXPORT_FIELDS})
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)


def _build_xlsx_path(rows: Iterator[dict]) -> str:
    """Write XLSX with constant_memory; caller streams then deletes the temp file."""
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    workbook = xlsxwriter.Workbook(path, {"constant_memory": True})
    worksheet = workbook.add_worksheet("reports")
    for col, name in enumerate(EXPORT_FIELDS):
        worksheet.write(0, col, name)
    for row_idx, row in enumerate(rows, start=1):
        for col, name in enumerate(EXPORT_FIELDS):
            value = row.get(name)
            worksheet.write(row_idx, col, "" if value is None else value)
    workbook.close()
    return path


@router.get("/export")
async def export_reports(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    min_severity: int | None = Query(default=None, ge=1, le=5),
    max_severity: int | None = Query(default=None, ge=1, le=5),
    created_after: str | None = None,
    created_before: str | None = None,
    bbox: str | None = None,
    officer: OfficerPrincipal = Depends(require_officer),
):
    """Stream filtered CSV/XLSX. Soft row cap ~10k (EXPORT_SOFT_ROW_CAP)."""
    _validate_report_filters(
        status=status,
        category=category,
        priority=priority,
        min_severity=min_severity,
        max_severity=max_severity,
    )
    if bbox:
        try:
            parse_bbox(bbox)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    filter_kwargs = {
        "status": status,
        "category": category,
        "priority": priority,
        "min_severity": min_severity,
        "max_severity": max_severity,
        "created_after": created_after,
        "created_before": created_before,
        "bbox": bbox,
        "caller_token": officer.token,
        "soft_cap": EXPORT_SOFT_ROW_CAP,
    }

    try:
        if format == "csv":
            rows = get_sink().iter_filtered(**filter_kwargs)
            return StreamingResponse(
                _csv_iter(rows),
                media_type="text/csv",
                headers={
                    "Content-Disposition": 'attachment; filename="reports.csv"'
                },
            )

        # XLSX: constant_memory write to temp file, then stream (never list(all)).
        path = _build_xlsx_path(get_sink().iter_filtered(**filter_kwargs))

        def file_chunks() -> Iterator[bytes]:
            try:
                with open(path, "rb") as handle:
                    while True:
                        chunk = handle.read(64 * 1024)
                        if not chunk:
                            break
                        yield chunk
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass

        return StreamingResponse(
            file_chunks(),
            media_type=XLSX_MEDIA_TYPE,
            headers={
                "Content-Disposition": 'attachment; filename="reports.xlsx"'
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Export failed: {exc}") from exc


@router.patch("/{report_id}/status")
async def update_report_status(
    report_id: str,
    status: str,
    note: str | None = None,
    officer: OfficerPrincipal = Depends(require_officer),
):
    if status not in VALID_STATUSES:
        raise HTTPException(422, "Invalid status")
    if status in {"resolved", "rejected"} and not (note or "").strip():
        raise HTTPException(422, "Note is required for resolved/rejected")

    try:
        sink = get_sink()
        if not sink.get_report(report_id, caller_token=officer.token):
            raise HTTPException(404, "Report not found")
        updated = sink.update_status(
            report_id,
            status,
            note,
            actor_id=officer.actor_id,
            caller_token=officer.token,
        )
        return {"report_id": report_id, "status": status, "updated": updated}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Status update failed: {exc}") from exc


@router.get("/{report_id}/image")
async def get_report_image(
    report_id: str, officer: OfficerPrincipal = Depends(require_officer)
):
    try:
        gcs_uri = get_sink().get_image_gcs_uri(report_id, caller_token=officer.token)
        if not gcs_uri:
            raise HTTPException(404, "No image found for this report")

        data, mime_type = get_evidence_storage().download_by_gcs_uri(gcs_uri)
        return Response(content=data, media_type=mime_type)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Image fetch failed: {exc}") from exc


@router.get("/{report_id}/status-history")
async def report_status_history(
    report_id: str, officer: OfficerPrincipal = Depends(require_officer)
):
    try:
        sink = get_sink()
        if not sink.get_report(report_id, caller_token=officer.token):
            raise HTTPException(404, "Report not found")
        items = sink.status_history(report_id, caller_token=officer.token)
        return {"items": items, "count": len(items)}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Status history query failed: {exc}") from exc


@router.get("/{report_id}")
async def report_detail(
    report_id: str, officer: OfficerPrincipal = Depends(require_officer)
):
    try:
        report = get_sink().get_report(report_id, caller_token=officer.token)
        if not report:
            raise HTTPException(404, "Report not found")
        return report
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Report query failed: {exc}") from exc
