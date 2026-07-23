-- Phase 8 Plan 01: async triage intake columns, claim RPCs, and intake-only report creation.

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS triage_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS triage_error TEXT,
    ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS triage_next_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS triage_attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS triage_claimed_at TIMESTAMPTZ;

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
            'manual_review'
        )
    );

CREATE INDEX IF NOT EXISTS reports_triage_pending_idx
    ON public.reports (created_at)
    WHERE triage_status = 'pending';

-- Intake-only atomic report + hashed token (NULL AI columns, triage_status pending).
CREATE OR REPLACE FUNCTION public.create_intake_report_with_access_token(
    p_report_id text,
    p_token_hash text,
    p_token_expires_at timestamptz,
    p_description text DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_longitude double precision DEFAULT NULL,
    p_evidence_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_report_id IS NULL OR btrim(p_report_id) = '' THEN
        RAISE EXCEPTION 'report_id is required';
    END IF;

    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'token_hash must be a 64-character lowercase hex SHA-256 digest';
    END IF;

    IF p_token_expires_at IS NULL THEN
        RAISE EXCEPTION 'token_expires_at is required';
    END IF;

    INSERT INTO public.reports (
        report_id,
        description,
        latitude,
        longitude,
        category,
        severity,
        confidence,
        summary,
        recommendation,
        priority,
        estimated_impact,
        evidence,
        uncertainty,
        urban_context,
        evidence_path,
        current_status,
        triage_status
    ) VALUES (
        p_report_id,
        p_description,
        p_latitude,
        p_longitude,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        '[]'::jsonb,
        '[]'::jsonb,
        NULL,
        p_evidence_path,
        'new',
        'pending'
    );

    INSERT INTO public.access_tokens (
        token_hash,
        report_id,
        expires_at
    ) VALUES (
        p_token_hash,
        p_report_id,
        p_token_expires_at
    );

    RETURN jsonb_build_object(
        'report_id', p_report_id,
        'triage_status', 'pending'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_intake_report_with_access_token(
    text, text, timestamptz, text, double precision, double precision, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_intake_report_with_access_token(
    text, text, timestamptz, text, double precision, double precision, text
) TO service_role;

-- Claim one pending report using CTE + FOR UPDATE SKIP LOCKED.
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
        WHERE triage_status = 'pending'
          AND (triage_next_attempt_at IS NULL OR triage_next_attempt_at <= now())
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

-- Reclaim stuck processing rows (default 15 minutes per D-11).
CREATE OR REPLACE FUNCTION public.reclaim_stuck_triage_reports(
    p_stuck_interval interval DEFAULT interval '15 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.reports
    SET
        triage_status = 'pending',
        triage_claimed_at = NULL,
        triage_attempt_count = triage_attempt_count + 1
    WHERE triage_status = 'processing'
      AND triage_claimed_at IS NOT NULL
      AND triage_claimed_at < now() - p_stuck_interval;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reclaim_stuck_triage_reports(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_triage_reports(interval) TO service_role;
