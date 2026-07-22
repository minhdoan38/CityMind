-- Phase 13: retry claim eligibility and claim_triage_report contract tests.
-- Run in Supabase SQL Editor or:
--   node scripts/run-supabase-sql.mjs -f supabase/tests/13_phase13_contract.sql
--
-- Prerequisite: migration 20260722170002_reports_triage_status_retry.sql applied.

CREATE OR REPLACE FUNCTION _test_assert(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT condition THEN
        RAISE EXCEPTION 'ASSERTION FAILED: %', message;
    END IF;
END;
$$;

-- 1) reports_triage_status_chk must allow retry disposition.
DO $$
DECLARE
    v_constraint_def text;
BEGIN
    SELECT pg_get_constraintdef(oid)
    INTO v_constraint_def
    FROM pg_constraint
    WHERE conname = 'reports_triage_status_chk'
      AND conrelid = 'public.reports'::regclass;

    PERFORM _test_assert(v_constraint_def IS NOT NULL, 'reports_triage_status_chk must exist');
    PERFORM _test_assert(
        v_constraint_def LIKE '%retry%',
        'reports_triage_status_chk must include retry'
    );
END;
$$;

-- 2) claim_triage_report function exists for service_role worker dispatch.
DO $$
BEGIN
    PERFORM _test_assert(
        to_regprocedure('public.claim_triage_report()') IS NOT NULL,
        'claim_triage_report function must exist'
    );
END;
$$;

-- 3) Due retry rows are claimable and transition to processing.
DO $$
DECLARE
    v_report_id text := 'test-phase13-retry-claim-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_claimed public.reports%ROWTYPE;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Retry claim eligibility fixture'
    );

    UPDATE public.reports
    SET
        triage_status = 'retry',
        triage_next_attempt_at = timezone('utc', now()) - interval '1 minute',
        triage_claimed_at = NULL,
        created_at = '1970-01-01'::timestamptz
    WHERE report_id = v_report_id;

    SELECT * INTO v_claimed
    FROM public.claim_triage_report()
    WHERE report_id = v_report_id
    LIMIT 1;

    PERFORM _test_assert(v_claimed.report_id = v_report_id, 'claim must return the due retry report');
    PERFORM _test_assert(v_claimed.triage_status = 'processing', 'claim must set triage_status to processing');
    PERFORM _test_assert(v_claimed.triage_claimed_at IS NOT NULL, 'claim must set triage_claimed_at');

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;
