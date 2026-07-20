-- Officer analytics views (ANLY-02 / D-05 / D-06 / D-14).
-- Replace PROJECT_ID before applying. Filter by created_at / closed_at in the API layer.

CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_volume_daily` AS
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS report_count
FROM `PROJECT_ID.citymind.reports_analytics`
GROUP BY day;

CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_category_mix` AS
SELECT
  COALESCE(category, 'unknown') AS category,
  COUNT(*) AS report_count
FROM `PROJECT_ID.citymind.reports_analytics`
GROUP BY category;

-- One close per report_id: MIN(resolved/rejected); open clock = report created_at (D-05 / D-14).
CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_sla_closed` AS
WITH closed AS (
  SELECT
    report_id,
    MIN(created_at) AS closed_at
  FROM `PROJECT_ID.citymind.status_events_analytics`
  WHERE status IN ('resolved', 'rejected')
  GROUP BY report_id
)
SELECT
  r.report_id,
  r.created_at AS opened_at,
  c.closed_at,
  DATE_DIFF(DATE(c.closed_at), DATE(r.created_at), DAY) AS days_to_close
FROM `PROJECT_ID.citymind.reports_analytics` r
INNER JOIN closed c USING (report_id);

CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_hotspot_category` AS
SELECT
  COALESCE(category, 'unknown') AS category,
  COUNT(*) AS report_count
FROM `PROJECT_ID.citymind.reports_analytics`
GROUP BY category
ORDER BY report_count DESC;
