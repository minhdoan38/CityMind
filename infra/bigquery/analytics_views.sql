-- Wave 0 stub — full view SQL in Plan 05-01 Task 2
-- Analytics views for officer charts (ANLY-02 / D-05 / D-06 / D-14).
CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_volume_daily` AS
SELECT CAST(NULL AS DATE) AS day, CAST(NULL AS INT64) AS report_count
WHERE FALSE;

CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_category_mix` AS
SELECT CAST(NULL AS STRING) AS category, CAST(NULL AS INT64) AS report_count
WHERE FALSE;

CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_sla_closed` AS
SELECT
  CAST(NULL AS STRING) AS report_id,
  CAST(NULL AS TIMESTAMP) AS opened_at,
  CAST(NULL AS TIMESTAMP) AS closed_at,
  CAST(NULL AS INT64) AS days_to_close
WHERE FALSE;

CREATE OR REPLACE VIEW `PROJECT_ID.citymind.v_hotspot_category` AS
SELECT CAST(NULL AS STRING) AS category, CAST(NULL AS INT64) AS report_count
WHERE FALSE;
