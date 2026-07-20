# Deploy CityMind analytics ETL (Cloud Run Job + Scheduler)

Daily Supabase → BigQuery incremental sync for analytics tables (`ANLY-01` / `D-01`).

**This checklist is USER-SETUP.** Fill in GCP project, region, and service-account names from your live environment — do not invent them. The agent ships code + this ops note only.

## Prerequisites

| Item | Notes |
|------|--------|
| BigQuery dataset `citymind` | Apply `infra/bigquery/reports_analytics.sql`, `status_events_analytics.sql`, `etl_watermarks.sql`, `analytics_views.sql` (replace `PROJECT_ID`) |
| Supabase service role | Job-only secret — never frontend |
| Container image | Same backend image as Cloud Run API (or dedicated) with working directory that can run `python -m app.jobs.etl_supabase_to_bigquery` |

## Job env / secrets

| Name | Source |
|------|--------|
| `SUPABASE_URL` | Supabase project settings → API |
| `SUPABASE_SECRET_KEY` | Supabase **service_role** secret (Job only) |
| `GOOGLE_CLOUD_PROJECT` | GCP project hosting the `citymind` BigQuery dataset |
| ADC / Job SA | BigQuery Data Editor (or narrower table-level) on analytics tables + watermarks |

Optional: `ENABLE_BIGQUERY=true` if your Settings gate requires it.

## Create Cloud Run Job

Replace placeholders (`YOUR_PROJECT`, `YOUR_REGION`, `YOUR_JOB_SA`, `YOUR_IMAGE`):

```bash
gcloud run jobs create citymind-etl \
  --project=YOUR_PROJECT \
  --region=YOUR_REGION \
  --image=YOUR_IMAGE \
  --service-account=YOUR_JOB_SA@YOUR_PROJECT.iam.gserviceaccount.com \
  --set-secrets=SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SECRET_KEY=SUPABASE_SECRET_KEY:latest \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,ENABLE_BIGQUERY=true \
  --command=python \
  --args=-m,app.jobs.etl_supabase_to_bigquery \
  --max-retries=1 \
  --task-timeout=30m
```

Manual recovery (full reload):

```bash
gcloud run jobs execute citymind-etl \
  --project=YOUR_PROJECT \
  --region=YOUR_REGION \
  --args=-m,app.jobs.etl_supabase_to_bigquery,--full-reload
```

(Exact `--args` / override syntax may vary by gcloud version — prefer Console → Job → Execute with args `--full-reload` if needed.)

## Create Cloud Scheduler trigger (`D-01`)

Cron: `0 6 * * *`  
Timezone: `Asia/Ho_Chi_Minh`  
Auth: OAuth service account with `roles/run.invoker` on the Job — **no public unauthenticated Job URL** (`T-05-05`).

```bash
gcloud scheduler jobs create http citymind-etl-daily \
  --project=YOUR_PROJECT \
  --location=YOUR_REGION \
  --schedule="0 6 * * *" \
  --time-zone="Asia/Ho_Chi_Minh" \
  --uri="https://run.googleapis.com/v2/projects/YOUR_PROJECT/locations/YOUR_REGION/jobs/citymind-etl:run" \
  --http-method=POST \
  --oauth-service-account-email=YOUR_SCHEDULER_SA@YOUR_PROJECT.iam.gserviceaccount.com
```

Official pattern: [Execute Cloud Run jobs on a schedule](https://cloud.google.com/run/docs/execute/jobs-on-schedule).

## Observability (`D-03`)

- Job must exit **non-zero** on failure; structured JSON logs use `event=etl_failure` / `etl_success`.
- In Cloud Logging, filter: `jsonPayload.event="etl_failure"` or text `etl_failure`.
- Optional: create a **log-based alert** on that filter (email/Pub/Sub). PagerDuty is **not** required for MVP.

## Least privilege (Job SA)

Prefer:

- BigQuery: write only to `reports_analytics`, `status_events_analytics`, staging tables, `etl_watermarks`; read not required beyond job metadata.
- Supabase: service role is powerful — restrict network egress if possible; never embed the key in the frontend image.

## Sync window

Default incremental path syncs rows with timestamps **strictly before** start of the current **UTC** day (data through previous UTC day), matching the ~06:00 ICT schedule.
