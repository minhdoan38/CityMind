"""Officer analytics API — GET /api/v1/analytics (ANLY-03 / D-07 / D-13 / D-18)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.schemas import AnalyticsResponse, PublicStatsResponse
from app.security import (
    OfficerPrincipal,
    enforce_public_stats_rate_limit,
    require_officer,
)
from app.services.analytics import get_analytics_service, validate_analytics_range

router = APIRouter()
public_router = APIRouter()


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


@public_router.get("/stats", response_model=PublicStatsResponse)
async def get_public_stats(
    request: Request,
    _: None = Depends(enforce_public_stats_rate_limit),
) -> PublicStatsResponse:
    """
    Public Home aggregates for the last 30 days (D-11 / D-13 / D-17).

    Unauthenticated count/category-only payload — no warehouse credentials to browser.
    """
    _ = request
    try:
        return get_analytics_service().fetch_public_stats()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "Public stats unavailable") from None
