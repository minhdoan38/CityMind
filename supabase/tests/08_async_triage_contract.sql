-- Phase 8: async triage intake + claim contract tests.
\set ON_ERROR_STOP on

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

-- 1) Intake RPC persists report with NULL AI columns and triage_status pending.
DO $$
DECLARE
    v_report_id text := 'test-intake-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_row public.reports%ROWTYPE;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Intake contract test'
    );

    SELECT * INTO v_row FROM public.reports WHERE report_id = v_report_id;

    PERFORM _test_assert(v_row.report_id = v_report_id, 'intake report must exist');
    PERFORM _test_assert(v_row.triage_status = 'pending', 'intake triage_status must be pending');
    PERFORM _test_assert(v_row.category IS NULL, 'intake category must be NULL');
    PERFORM _test_assert(v_row.severity IS NULL, 'intake severity must be NULL');
    PERFORM _test_assert(v_row.summary IS NULL, 'intake summary must be NULL');
    PERFORM _test_assert(
        EXISTS (
            SELECT 1 FROM public.access_tokens
            WHERE report_id = v_report_id AND token_hash = v_token_hash
        ),
        'intake access token row must exist'
    );

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 2) claim_triage_report transitions pending → processing (single winner).
DO $$
DECLARE
    v_report_id text := 'test-claim-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_claimed public.reports%ROWTYPE;
    v_status text;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Claim contract test'
    );

    SELECT * INTO v_claimed FROM public.claim_triage_report() LIMIT 1;

    PERFORM _test_assert(v_claimed.report_id = v_report_id, 'claim must return seeded report');
    PERFORM _test_assert(v_claimed.triage_status = 'processing', 'claim must set processing');
    PERFORM _test_assert(v_claimed.triage_claimed_at IS NOT NULL, 'claim must set triage_claimed_at');

    SELECT triage_status INTO v_status FROM public.reports WHERE report_id = v_report_id;
    PERFORM _test_assert(v_status = 'processing', 'report row must be processing after claim');

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 3) reclaim_stuck_triage_reports resets stale processing after 15 minutes.
DO $$
DECLARE
    v_report_id text := 'test-reclaim-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_reclaimed integer;
    v_status text;
    v_attempt_count integer;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Reclaim contract test'
    );

    UPDATE public.reports
    SET
        triage_status = 'processing',
        triage_claimed_at = now() - interval '20 minutes',
        triage_attempt_count = 0
    WHERE report_id = v_report_id;

    v_reclaimed := public.reclaim_stuck_triage_reports(interval '15 minutes');

    PERFORM _test_assert(v_reclaimed >= 1, 'reclaim must reset at least one stuck row');

    SELECT triage_status, triage_attempt_count
    INTO v_status, v_attempt_count
    FROM public.reports
    WHERE report_id = v_report_id;

    PERFORM _test_assert(v_status = 'pending', 'reclaimed row must return to pending');
    PERFORM _test_assert(v_attempt_count = 1, 'reclaim must increment triage_attempt_count');
    PERFORM _test_assert(
        (SELECT triage_claimed_at FROM public.reports WHERE report_id = v_report_id) IS NULL,
        'reclaim must clear triage_claimed_at'
    );

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 4) create_intake_report_with_access_token is service_role-only.
DO $$
BEGIN
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.create_intake_report_with_access_token(
            p_report_id := 'test-intake-anon-' || gen_random_uuid()::text,
            p_token_hash := encode(digest('anon-denied-intake', 'sha256'), 'hex'),
            p_token_expires_at := timezone('utc', now()) + interval '365 days'
        );
        RESET ROLE;
        RAISE EXCEPTION 'anon must not execute create_intake_report_with_access_token';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
    END;
END;
$$;

-- 5) claim_triage_report is service_role-only.
DO $$
BEGIN
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM count(*)::integer FROM public.claim_triage_report();
        RESET ROLE;
        RAISE EXCEPTION 'anon must not execute claim_triage_report';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
    END;
END;
$$;

-- 6) Audit tables link attempts to runs.
DO $$
DECLARE
    v_report_id text := 'test-audit-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_run_id uuid := gen_random_uuid();
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Audit contract test'
    );

    INSERT INTO public.triage_runs (run_id, report_id, prompt_version)
    VALUES (v_run_id, v_report_id, 'phase8-mvp-v1');

    INSERT INTO public.triage_attempts (
        run_id,
        attempt_number,
        model,
        prompt_version,
        raw_output,
        latency_ms,
        validation_errors,
        disposition
    ) VALUES (
        v_run_id,
        1,
        'test-model',
        'phase8-mvp-v1',
        '{"category":"pothole"}',
        10,
        '[]'::jsonb,
        'completed'
    );

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.triage_attempts ta
            JOIN public.triage_runs tr ON tr.run_id = ta.run_id
            WHERE tr.report_id = v_report_id
        ),
        'triage_attempts must link to triage_runs for report'
    );

    DELETE FROM public.triage_attempts WHERE run_id = v_run_id;
    DELETE FROM public.triage_runs WHERE run_id = v_run_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

DROP FUNCTION IF EXISTS _test_assert(boolean, text);
