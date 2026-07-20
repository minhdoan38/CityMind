-- Wave 0 stub — full DDL in Plan 05-01 Task 2
-- Control table for dual-watermark incremental ETL (D-02 / D-03).
CREATE TABLE IF NOT EXISTS `PROJECT_ID.citymind.etl_watermarks` (
  pipeline STRING NOT NULL,
  watermark TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
);
