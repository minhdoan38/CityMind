-- Allow retry triage_status written by complete_triage_report on infra/policy backoff.

ALTER TABLE public.reports
    DROP CONSTRAINT IF EXISTS reports_triage_status_chk;

ALTER TABLE public.reports
    ADD CONSTRAINT reports_triage_status_chk
    CHECK (
        triage_status IN (
            'pending',
            'processing',
            'completed',
            'failed',
            'manual_review',
            'retry'
        )
    );

CREATE INDEX IF NOT EXISTS reports_triage_retry_due_idx
    ON public.reports (triage_next_attempt_at)
    WHERE triage_status = 'retry';

-- Claim pending rows or retry rows whose backoff window has elapsed.
CREATE OR REPLACE FUNCTION public.claim_triage_report()
RETURNS SETOF public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH next_report AS (
        SELECT report_id
        FROM public.reports
        WHERE (
            triage_status = 'pending'
            OR (
                triage_status = 'retry'
                AND (triage_next_attempt_at IS NULL OR triage_next_attempt_at <= now())
            )
        )
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    UPDATE public.reports r
    SET
        triage_status = 'processing',
        triage_claimed_at = now()
    FROM next_report
    WHERE r.report_id = next_report.report_id
    RETURNING r.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_triage_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_triage_report() TO service_role;
