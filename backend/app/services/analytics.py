"""Officer analytics read service — parameterized BigQuery view queries (ANLY-03)."""

from __future__ import annotations

import statistics
from datetime import date, timedelta
from functools import lru_cache

from google.cloud import bigquery

from app.config import Settings, get_settings
from app.schemas import (
    AnalyticsCategoryCount,
    AnalyticsHotspotRow,
    AnalyticsResponse,
    AnalyticsSlaBucket,
    AnalyticsSlaSummary,
    AnalyticsVolumePoint,
    PublicCategoryStat,
    PublicStatsResponse,
)

# View names from infra/bigquery/analytics_views.sql (ANLY-02).
VIEW_VOLUME_DAILY = "v_volume_daily"
VIEW_CATEGORY_MIX = "v_category_mix"
VIEW_SLA_CLOSED = "v_sla_closed"
VIEW_HOTSPOT_CATEGORY = "v_hotspot_category"

MAX_ANALYTICS_SPAN_DAYS = 366
HOTSPOT_TOP_N = 10
PUBLIC_STATS_WINDOW_DAYS = 30
PUBLIC_STATS_TOP_N = 2
PUBLIC_STATS_K_MIN = 3

_SLA_BUCKETS: tuple[tuple[str, int | None], ...] = (
    ("0-1", 1),
    ("2-3", 3),
    ("4-7", 7),
    ("8-14", 14),
    ("15+", None),
)


class AnalyticsService:
    """Server-side BigQuery reads for officer analytics — never expose BQ creds (D-13)."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.enabled = settings.enable_bigquery
        self.project = settings.google_cloud_project
        self.dataset = settings.bigquery_dataset
        self._client: bigquery.Client | None = None

    @property
    def client(self) -> bigquery.Client | None:
        if not self.enabled:
            return None
        if self._client is None:
            self._client = bigquery.Client(project=self.project)
        return self._client

    def _fq(self, view_name: str) -> str:
        return f"{self.project}.{self.dataset}.{view_name}"

    def _reports_table(self) -> str:
        return f"{self.project}.{self.dataset}.reports_analytics"

    def fetch_public_stats(self) -> PublicStatsResponse:
        """Last-30d public aggregates with k≥3 category filter (D-11 / D-17)."""
        date_to = date.today()
        date_from = date_to - timedelta(days=PUBLIC_STATS_WINDOW_DAYS - 1)
        if not self.enabled or self.client is None:
            return PublicStatsResponse(total_last_30d=0, top_categories=[])

        total = self._query_total_reports(date_from, date_to)
        category_mix = self._query_category_mix(date_from, date_to)
        top_categories = _public_top_categories(category_mix)
        return PublicStatsResponse(
            total_last_30d=total,
            top_categories=top_categories,
        )

    def fetch(
        self,
        date_from: date,
        date_to: date,
    ) -> AnalyticsResponse:
        if not self.enabled or self.client is None:
            return AnalyticsResponse(
                from_date=date_from,
                to_date=date_to,
                empty=True,
            )

        volume = self._query_volume(date_from, date_to)
        category_mix = self._query_category_mix(date_from, date_to)
        sla = self._query_sla(date_from, date_to)
        hotspots = self._query_hotspots(date_from, date_to)

        empty = (
            not volume
            and not category_mix
            and sla.closed_count == 0
            and not hotspots
        )
        return AnalyticsResponse(
            from_date=date_from,
            to_date=date_to,
            empty=empty,
            volume=volume,
            category_mix=category_mix,
            sla=sla,
            hotspots=hotspots,
        )

    def _date_params(
        self, date_from: date, date_to: date
    ) -> list[bigquery.ScalarQueryParameter]:
        return [
            bigquery.ScalarQueryParameter("from_date", "DATE", date_from),
            bigquery.ScalarQueryParameter("to_date", "DATE", date_to),
        ]

    def _query_total_reports(self, date_from: date, date_to: date) -> int:
        assert self.client is not None
        query = f"""
        SELECT COUNT(*) AS report_count
        FROM `{self._reports_table()}`
        WHERE DATE(created_at) BETWEEN @from_date AND @to_date
        """
        rows = list(
            self.client.query(
                query,
                job_config=bigquery.QueryJobConfig(
                    query_parameters=self._date_params(date_from, date_to)
                ),
            ).result()
        )
        return int(rows[0]["report_count"]) if rows else 0

    def _query_volume(
        self, date_from: date, date_to: date
    ) -> list[AnalyticsVolumePoint]:
        assert self.client is not None
        query = f"""
        SELECT day, report_count
        FROM `{self._fq(VIEW_VOLUME_DAILY)}`
        WHERE day BETWEEN @from_date AND @to_date
        ORDER BY day
        """
        rows = self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=self._date_params(date_from, date_to)
            ),
        ).result()
        return [
            AnalyticsVolumePoint(day=row["day"], report_count=int(row["report_count"]))
            for row in rows
        ]

    def _query_category_mix(
        self, date_from: date, date_to: date
    ) -> list[AnalyticsCategoryCount]:
        """
        Date-filtered category mix aligned with v_category_mix (view has no day column;
        filter DATE(created_at) in API layer per analytics_views.sql comment).
        """
        assert self.client is not None
        # Date filter on base table — v_category_mix has no day column (API-layer filter).
        query = f"""
        SELECT
          COALESCE(category, 'unknown') AS category,
          COUNT(*) AS report_count
        FROM `{self._reports_table()}`
        WHERE DATE(created_at) BETWEEN @from_date AND @to_date
        GROUP BY category
        ORDER BY report_count DESC, category
        """
        rows = self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=self._date_params(date_from, date_to)
            ),
        ).result()
        return [
            AnalyticsCategoryCount(
                category=row["category"], report_count=int(row["report_count"])
            )
            for row in rows
        ]

    def _query_sla(
        self, date_from: date, date_to: date
    ) -> AnalyticsSlaSummary:
        """Closed-in-range SLA from v_sla_closed (D-05 / D-06)."""
        assert self.client is not None
        query = f"""
        SELECT days_to_close
        FROM `{self._fq(VIEW_SLA_CLOSED)}`
        WHERE DATE(closed_at) BETWEEN @from_date AND @to_date
        """
        rows = list(
            self.client.query(
                query,
                job_config=bigquery.QueryJobConfig(
                    query_parameters=self._date_params(date_from, date_to)
                ),
            ).result()
        )
        days = [int(row["days_to_close"]) for row in rows]
        if not days:
            return AnalyticsSlaSummary()

        histogram = _build_sla_histogram(days)
        return AnalyticsSlaSummary(
            closed_count=len(days),
            median_days=float(statistics.median(days)),
            avg_days=round(float(statistics.mean(days)), 2),
            histogram=histogram,
        )

    def _query_hotspots(
        self, date_from: date, date_to: date
    ) -> list[AnalyticsHotspotRow]:
        """Top categories in range — mirrors v_hotspot_category with date filter."""
        assert self.client is not None
        # Mirrors v_hotspot_category with DATE(created_at) range (view has no day).
        query = f"""
        SELECT
          COALESCE(category, 'unknown') AS category,
          COUNT(*) AS report_count
        FROM `{self._reports_table()}`
        WHERE DATE(created_at) BETWEEN @from_date AND @to_date
        GROUP BY category
        ORDER BY report_count DESC, category
        LIMIT @top_n
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                *self._date_params(date_from, date_to),
                bigquery.ScalarQueryParameter("top_n", "INT64", HOTSPOT_TOP_N),
            ]
        )
        rows = self.client.query(query, job_config=job_config).result()
        return [
            AnalyticsHotspotRow(
                category=row["category"], report_count=int(row["report_count"])
            )
            for row in rows
        ]


def _public_top_categories(
    category_mix: list[AnalyticsCategoryCount],
) -> list[PublicCategoryStat]:
    """Omit cells under k-anonymity threshold; cap at top 1–2 (D-17)."""
    eligible = [
        PublicCategoryStat(category=row.category, count=row.report_count)
        for row in category_mix
        if row.report_count >= PUBLIC_STATS_K_MIN
    ]
    return eligible[:PUBLIC_STATS_TOP_N]


def _build_sla_histogram(days: list[int]) -> list[AnalyticsSlaBucket]:
    counts = {label: 0 for label, _ in _SLA_BUCKETS}
    for value in days:
        if value <= 1:
            counts["0-1"] += 1
        elif value <= 3:
            counts["2-3"] += 1
        elif value <= 7:
            counts["4-7"] += 1
        elif value <= 14:
            counts["8-14"] += 1
        else:
            counts["15+"] += 1
    return [
        AnalyticsSlaBucket(label=label, count=counts[label])
        for label, _ in _SLA_BUCKETS
    ]


def validate_analytics_range(date_from: date, date_to: date) -> None:
    """Raise ValueError for invalid ranges (API maps to 422)."""
    if date_from > date_to:
        raise ValueError("Invalid date range: from cannot be after to")
    span = (date_to - date_from).days
    if span > MAX_ANALYTICS_SPAN_DAYS:
        raise ValueError(
            f"Date range cannot exceed {MAX_ANALYTICS_SPAN_DAYS} days"
        )


@lru_cache
def get_analytics_service() -> AnalyticsService:
    return AnalyticsService(get_settings())
