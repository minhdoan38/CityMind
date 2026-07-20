-- Dual-watermark control table for incremental Supabase → BigQuery ETL (D-02 / D-03).
CREATE TABLE IF NOT EXISTS `PROJECT_ID.citymind.etl_watermarks` (
  pipeline STRING NOT NULL,
  watermark TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
);
