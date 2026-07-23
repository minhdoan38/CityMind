-- Phase 14: triage audit table privilege contract tests.
-- Run in Supabase SQL Editor or:
--   node scripts/run-supabase-sql.mjs -f supabase/tests/14_phase14_contract.sql
--
-- Prerequisite: migration 20260722120002_async_triage_audit.sql applied.

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

DO $$
BEGIN
    IF to_regclass('public.triage_runs') IS NULL THEN
        RAISE EXCEPTION
            'Missing public.triage_runs. Apply migration 20260722120002_async_triage_audit.sql before this contract test.';
    END IF;
    IF to_regclass('public.triage_attempts') IS NULL THEN
        RAISE EXCEPTION
            'Missing public.triage_attempts. Apply migration 20260722120002_async_triage_audit.sql before this contract test.';
    END IF;
END;
$$;

-- triage_runs and triage_attempts are service_role only; anon and authenticated cannot read.
DO $$
DECLARE
    v_report_id text := 'test-phase14-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_run_id uuid;
    v_attempt_id uuid;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Phase 14 contract fixture'
    );

    INSERT INTO public.triage_runs (report_id, prompt_version, final_disposition)
    VALUES (v_report_id, '1.0.0', 'completed')
    RETURNING run_id INTO v_run_id;

    INSERT INTO public.triage_attempts (
        run_id,
        attempt_number,
        model,
        prompt_version,
        raw_output,
        latency_ms,
        validation_errors,
        disposition
    )
    VALUES (v_run_id, 1, 'test-model', '1.0.0', '{}', 12, '[]'::jsonb, 'completed')
    RETURNING attempt_id INTO v_attempt_id;

    BEGIN
        SET LOCAL ROLE anon;
        PERFORM 1 FROM public.triage_runs WHERE run_id = v_run_id LIMIT 1;
        RAISE EXCEPTION 'anon must not read triage_runs';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM 1 FROM public.triage_attempts WHERE attempt_id = v_attempt_id LIMIT 1;
        RAISE EXCEPTION 'authenticated must not read triage_attempts';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    DELETE FROM public.triage_attempts WHERE attempt_id = v_attempt_id;
    DELETE FROM public.triage_runs WHERE run_id = v_run_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;
