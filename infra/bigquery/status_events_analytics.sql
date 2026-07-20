-- Analytics-safe status events (ANLY-01 / D-16).
-- Omits note and actor_id — officer identity / free-text notes stay in Supabase ops.
CREATE TABLE IF NOT EXISTS `PROJECT_ID.citymind.status_events_analytics` (
  event_id STRING NOT NULL,
  report_id STRING NOT NULL,
  status STRING NOT NULL,
  created_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY report_id, status;
