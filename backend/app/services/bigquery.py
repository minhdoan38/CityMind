import json
from datetime import datetime, timezone

from google.cloud import bigquery

from app.config import Settings


class BigQueryReportSink:
    def __init__(self, settings: Settings):
        self.enabled = settings.enable_bigquery
        self.status_table_id = (
            f"{settings.google_cloud_project}."
            f"{settings.bigquery_dataset}.report_status_events"
        )
        self.table_id = (
            f"{settings.google_cloud_project}."
            f"{settings.bigquery_dataset}.{settings.bigquery_reports_table}"
        )
        self.client = (
            bigquery.Client(project=settings.google_cloud_project)
            if self.enabled
            else None
        )

    def list_recent(
        self,
        limit: int = 20,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        min_severity: int | None = None,
        max_severity: int | None = None,
    ) -> list[dict]:
        if not self.enabled or self.client is None:
            return []

        query = f"""
        WITH latest_status AS (
            SELECT report_id, status, note, created_at
            FROM `{self.status_table_id}`
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY report_id ORDER BY created_at DESC
            ) = 1
        )
        SELECT
            r.report_id, r.urban_context, r.created_at, r.image_gcs_uri,
            r.description, r.latitude, r.longitude, r.category, r.severity,
            r.confidence, r.summary, r.recommendation, r.priority,
            r.estimated_impact, r.evidence, r.uncertainty,
            COALESCE(s.status, 'new') AS status,
            s.note AS status_note
        FROM `{self.table_id}` r
        LEFT JOIN latest_status s USING(report_id)
        WHERE (@status IS NULL OR COALESCE(s.status, 'new') = @status)
          AND (@category IS NULL OR r.category = @category)
          AND (@priority IS NULL OR r.priority = @priority)
          AND (@min_severity IS NULL OR r.severity >= @min_severity)
          AND (@max_severity IS NULL OR r.severity <= @max_severity)
        ORDER BY r.created_at DESC
        LIMIT @limit
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("limit", "INT64", limit),
                bigquery.ScalarQueryParameter("status", "STRING", status),
                bigquery.ScalarQueryParameter("category", "STRING", category),
                bigquery.ScalarQueryParameter("priority", "STRING", priority),
                bigquery.ScalarQueryParameter(
                    "min_severity", "INT64", min_severity
                ),
                bigquery.ScalarQueryParameter(
                    "max_severity", "INT64", max_severity
                ),
            ]
        )
        rows = self.client.query(query, job_config=job_config).result()
        return [dict(row) for row in rows]

    def insert(
        self,
        report_id,
        description,
        latitude,
        longitude,
        analysis,
        urban_context=None,
        image_gcs_uri: str | None = None,
    ) -> bool:
        if not self.enabled or self.client is None:
            return False

        row = {
            "report_id": report_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "description": description,
            "latitude": latitude,
            "longitude": longitude,
            "urban_context": json.dumps(urban_context or {}, ensure_ascii=False),
            "image_gcs_uri": image_gcs_uri,
            **analysis.model_dump(mode="json"),
        }
        errors = self.client.insert_rows_json(
            self.table_id, [row], row_ids=[report_id]
        )
        if errors:
            raise RuntimeError(f"BigQuery insert failed: {errors}")
        return True

    def summary(self) -> dict:
        if not self.enabled or self.client is None:
            return {
                "total_reports": 0,
                "critical_reports": 0,
                "avg_severity": 0,
                "top_category": "none",
            }

        query = f"""
        WITH base AS (
            SELECT category, severity, priority
            FROM `{self.table_id}`
        ),
        cat AS (
            SELECT category, COUNT(*) AS n
            FROM base
            GROUP BY category
            ORDER BY n DESC
            LIMIT 1
        )
        SELECT
            COUNT(1) AS total_reports,
            COUNTIF(priority = 'critical') AS critical_reports,
            COALESCE(ROUND(AVG(severity), 2), 0) AS avg_severity,
            COALESCE((SELECT category FROM cat), 'none') AS top_category
        FROM base
        """
        row = list(self.client.query(query).result())[0]
        return dict(row)

    def update_status(
        self, report_id: str, status: str, note: str | None = None
    ) -> bool:
        if not self.enabled or self.client is None:
            return False

        row = {
            "report_id": report_id,
            "status": status,
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        errors = self.client.insert_rows_json(self.status_table_id, [row])
        if errors:
            raise RuntimeError(f"BigQuery status insert failed: {errors}")
        return True

    def get_image_gcs_uri(self, report_id: str) -> str | None:
        if not self.enabled or self.client is None:
            return None

        query = f"""
        SELECT image_gcs_uri
        FROM `{self.table_id}`
        WHERE report_id = @report_id
        LIMIT 1
        """
        job_config = self._report_id_job_config(report_id)
        rows = list(self.client.query(query, job_config=job_config).result())
        return rows[0].get("image_gcs_uri") if rows else None

    def get_report(self, report_id: str) -> dict | None:
        if not self.enabled or self.client is None:
            return None

        query = f"""
        WITH latest_status AS (
            SELECT report_id, status, note, created_at
            FROM `{self.status_table_id}`
            WHERE report_id = @report_id
            QUALIFY ROW_NUMBER() OVER (ORDER BY created_at DESC) = 1
        )
        SELECT
            r.*,
            COALESCE(s.status, 'new') AS status,
            s.note AS status_note,
            s.created_at AS status_updated_at
        FROM `{self.table_id}` r
        LEFT JOIN latest_status s USING(report_id)
        WHERE r.report_id = @report_id
        LIMIT 1
        """
        job_config = self._report_id_job_config(report_id)
        rows = list(self.client.query(query, job_config=job_config).result())
        return dict(rows[0]) if rows else None

    def status_history(self, report_id: str) -> list[dict]:
        if not self.enabled or self.client is None:
            return []

        query = f"""
        SELECT status, note, created_at
        FROM `{self.status_table_id}`
        WHERE report_id = @report_id
        ORDER BY created_at DESC
        """
        job_config = self._report_id_job_config(report_id)
        rows = self.client.query(query, job_config=job_config).result()
        return [dict(row) for row in rows]

    @staticmethod
    def _report_id_job_config(report_id: str) -> bigquery.QueryJobConfig:
        return bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "report_id", "STRING", report_id
                )
            ]
        )


class BigQueryAnalyticsWarehouse:
    """
    Analytics-only BigQuery writer for Supabase → BQ ETL (ANLY-01).

    Ops CRUD stays on Supabase (D-04). WatermarkStore protocol: get/set.
    """

    PIPELINE_REPORTS = "reports"
    PIPELINE_EVENTS = "status_events"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.enabled = settings.enable_bigquery
        self.project = settings.google_cloud_project
        self.dataset = settings.bigquery_dataset
        self.reports_table = (
            f"{self.project}.{self.dataset}.reports_analytics"
        )
        self.events_table = (
            f"{self.project}.{self.dataset}.status_events_analytics"
        )
        self.watermarks_table = (
            f"{self.project}.{self.dataset}.etl_watermarks"
        )
        self.reports_staging = (
            f"{self.project}.{self.dataset}.reports_analytics_staging"
        )
        self.client = (
            bigquery.Client(project=self.project) if self.enabled else None
        )

    def get(self, pipeline: str) -> datetime | None:
        if not self.enabled or self.client is None:
            return None
        query = f"""
        SELECT watermark
        FROM `{self.watermarks_table}`
        WHERE pipeline = @pipeline
        LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("pipeline", "STRING", pipeline)
            ]
        )
        rows = list(self.client.query(query, job_config=job_config).result())
        if not rows:
            return None
        value = rows[0].get("watermark")
        if value is None:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return value

    def set(self, pipeline: str, watermark: datetime) -> None:
        if not self.enabled or self.client is None:
            raise RuntimeError("BigQuery is not enabled for watermark write")
        if watermark.tzinfo is None:
            watermark = watermark.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        merge = f"""
        MERGE `{self.watermarks_table}` T
        USING (
          SELECT @pipeline AS pipeline, @watermark AS watermark, @updated_at AS updated_at
        ) S
        ON T.pipeline = S.pipeline
        WHEN MATCHED THEN UPDATE SET
          watermark = S.watermark,
          updated_at = S.updated_at
        WHEN NOT MATCHED THEN INSERT (pipeline, watermark, updated_at)
        VALUES (S.pipeline, S.watermark, S.updated_at)
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("pipeline", "STRING", pipeline),
                bigquery.ScalarQueryParameter(
                    "watermark", "TIMESTAMP", watermark
                ),
                bigquery.ScalarQueryParameter(
                    "updated_at", "TIMESTAMP", now
                ),
            ]
        )
        self.client.query(merge, job_config=job_config).result()

    def load_analytics_batch(self, batch, *, full_reload: bool = False) -> bool:
        """Stage + MERGE reports; MERGE/append events by event_id. Raises on failure."""
        if not self.enabled or self.client is None:
            raise RuntimeError("BigQuery is not enabled for analytics load")

        if full_reload:
            self._truncate(self.reports_table)
            self._truncate(self.events_table)

        reports = list(getattr(batch, "reports", []) or [])
        events = list(getattr(batch, "events", []) or [])

        if reports:
            self._merge_reports(reports)
        if events:
            self._merge_events(events)
        return True

    def _truncate(self, table_id: str) -> None:
        assert self.client is not None
        self.client.query(f"TRUNCATE TABLE `{table_id}`").result()

    def _load_json_rows(self, table_id: str, rows: list[dict], write_disposition: str) -> None:
        assert self.client is not None
        job_config = bigquery.LoadJobConfig(
            write_disposition=write_disposition,
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            autodetect=False,
        )
        # Ensure TIMESTAMP-friendly ISO strings.
        normalized = []
        for row in rows:
            item = dict(row)
            for key, value in list(item.items()):
                if isinstance(value, datetime):
                    item[key] = value.astimezone(timezone.utc).isoformat()
            normalized.append(item)
        job = self.client.load_table_from_json(
            normalized, table_id, job_config=job_config
        )
        result = job.result()
        if job.errors:
            raise RuntimeError(f"BigQuery load failed for {table_id}: {job.errors}")
        _ = result

    def _ensure_staging_reports(self) -> None:
        assert self.client is not None
        ddl = f"""
        CREATE TABLE IF NOT EXISTS `{self.reports_staging}` (
          report_id STRING NOT NULL,
          created_at TIMESTAMP NOT NULL,
          category STRING,
          severity INT64,
          priority STRING,
          current_status STRING,
          latitude FLOAT64,
          longitude FLOAT64
        )
        """
        self.client.query(ddl).result()

    def _merge_reports(self, reports: list[dict]) -> None:
        assert self.client is not None
        self._ensure_staging_reports()
        self._load_json_rows(
            self.reports_staging,
            reports,
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        )
        merge = f"""
        MERGE `{self.reports_table}` T
        USING `{self.reports_staging}` S
        ON T.report_id = S.report_id
        WHEN MATCHED THEN UPDATE SET
          created_at = S.created_at,
          category = S.category,
          severity = S.severity,
          priority = S.priority,
          current_status = S.current_status,
          latitude = S.latitude,
          longitude = S.longitude
        WHEN NOT MATCHED THEN INSERT (
          report_id, created_at, category, severity, priority,
          current_status, latitude, longitude
        )
        VALUES (
          S.report_id, S.created_at, S.category, S.severity, S.priority,
          S.current_status, S.latitude, S.longitude
        )
        """
        self.client.query(merge).result()

    def _merge_events(self, events: list[dict]) -> None:
        assert self.client is not None
        staging = f"{self.project}.{self.dataset}.status_events_analytics_staging"
        ddl = f"""
        CREATE TABLE IF NOT EXISTS `{staging}` (
          event_id STRING NOT NULL,
          report_id STRING NOT NULL,
          status STRING NOT NULL,
          created_at TIMESTAMP NOT NULL
        )
        """
        self.client.query(ddl).result()
        self._load_json_rows(
            staging,
            events,
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        )
        merge = f"""
        MERGE `{self.events_table}` T
        USING `{staging}` S
        ON T.event_id = S.event_id
        WHEN NOT MATCHED THEN INSERT (event_id, report_id, status, created_at)
        VALUES (S.event_id, S.report_id, S.status, S.created_at)
        """
        self.client.query(merge).result()
