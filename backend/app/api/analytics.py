"""Officer analytics API — GET /api/v1/analytics (ANLY-03 / D-07 / D-13 / D-18)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.schemas import AnalyticsResponse
from app.security import OfficerPrincipal, require_officer
from app.services.analytics import get_analytics_service, validate_analytics_range

router = APIRouter()


@router.get("", response_model=AnalyticsResponse, response_model_by_alias=True)
async def get_officer_analytics(
    date_from: date = Query(..., alias="from", description="UTC inclusive start date"),
    date_to: date = Query(..., alias="to", description="UTC inclusive end date"),
    officer: OfficerPrincipal = Depends(require_officer),
) -> AnalyticsResponse:
    """
    Chart-ready warehouse aggregates for the selected UTC date range.

    Requires officer JWT (D-07). BigQuery credentials stay server-side (D-13).
    """
    _ = officer  # auth gate only
    try:
        validate_analytics_range(date_from, date_to)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    try:
        return get_analytics_service().fetch(date_from, date_to)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Analytics query failed: {exc}") from exc
