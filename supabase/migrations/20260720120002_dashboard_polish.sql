-- Phase 3 dashboard polish: denormalized current_status + status actor_id
-- Additive only — does not rewrite Phase 1 RLS policies.

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS current_status TEXT NOT NULL DEFAULT 'new';

ALTER TABLE public.status_events
    ADD COLUMN IF NOT EXISTS actor_id TEXT;

-- Backfill current_status from the latest status_events row per report.
UPDATE public.reports AS r
SET current_status = COALESCE(
    (
        SELECT se.status
        FROM public.status_events AS se
        WHERE se.report_id = r.report_id
        ORDER BY se.created_at DESC
        LIMIT 1
    ),
    'new'
);

CREATE INDEX IF NOT EXISTS reports_current_status_created_at_idx
    ON public.reports (current_status, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_priority_report_id_idx
    ON public.reports (priority, report_id);

CREATE INDEX IF NOT EXISTS reports_category_report_id_idx
    ON public.reports (category, report_id);

CREATE INDEX IF NOT EXISTS reports_created_at_report_id_idx
    ON public.reports (created_at DESC, report_id DESC);

CREATE INDEX IF NOT EXISTS status_events_actor_id_idx
    ON public.status_events (actor_id);
