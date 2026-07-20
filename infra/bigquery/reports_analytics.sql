-- Analytics-safe reports fact table (ANLY-01 / D-16).
-- Prefer new *_analytics tables — do not DROP/ALTER legacy citymind.reports.
CREATE TABLE IF NOT EXISTS `PROJECT_ID.citymind.reports_analytics` (
  report_id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  category STRING,
  severity INT64,
  priority STRING,
  current_status STRING,
  latitude FLOAT64,
  longitude FLOAT64
)
PARTITION BY DATE(created_at)
CLUSTER BY category, priority;
