-- Phase 11: evaluator 11-key RPC contract tests.
-- Run in Supabase SQL Editor or:
--   node scripts/run-supabase-sql.mjs -f supabase/tests/11_phase11_contract.sql

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

-- 1) complete_triage_report v2 persists 11-key evaluator fields + legacy dual-write.
DO $$
DECLARE
    v_report_id text := 'test-phase11-v2-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_run_id uuid;
    v_row public.reports%ROWTYPE;
    v_analysis jsonb := jsonb_build_object(
        'category', 'flooding',
        'observed_facts', jsonb_build_array('Standing water blocks the crosswalk.'),
        'inferences', jsonb_build_array('Pedestrian access may be impaired.'),
        'unknowns', jsonb_build_array('Drainage cause is unknown.'),
        'severity', 4,
        'severity_reason', 'Standing water blocks the crosswalk.',
        'priority', 'high',
        'priority_reason', 'Material access disruption without confirmed imminent danger.',
        'confidence', 0.78,
        'recommended_action', 'Inspect drainage and post temporary signage.',
        'requires_human_review', true
    );
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Flooded crosswalk near school'
    );

    INSERT INTO public.triage_runs (report_id, prompt_version)
    VALUES (v_report_id, '1.0.0')
    RETURNING run_id INTO v_run_id;

    PERFORM public.complete_triage_report(
        p_report_id := v_report_id,
        p_analysis := v_analysis,
        p_disposition := 'completed',
        p_run_id := v_run_id,
        p_attempt_number := 1,
        p_model := 'test-model',
        p_prompt_version := '1.0.0',
        p_raw_output := v_analysis::text,
        p_latency_ms := 42,
        p_validation_errors := '[]'::jsonb,
        p_finish_run := true
    );

    SELECT * INTO v_row FROM public.reports WHERE report_id = v_report_id;

    PERFORM _test_assert(v_row.triage_status = 'completed', 'triage_status must be completed');
    PERFORM _test_assert(jsonb_array_length(v_row.observed_facts) > 0, 'observed_facts must be non-empty');
    PERFORM _test_assert(v_row.severity_reason IS NOT NULL, 'severity_reason must be persisted');
    PERFORM _test_assert(v_row.recommended_action IS NOT NULL, 'recommended_action must be persisted');
    PERFORM _test_assert(v_row.requires_human_review IS TRUE, 'requires_human_review must be true');
    PERFORM _test_assert(v_row.summary IS NOT NULL, 'legacy summary must be dual-written');
    PERFORM _test_assert(v_row.recommendation IS NOT NULL, 'legacy recommendation must be dual-written');
    PERFORM _test_assert(jsonb_array_length(v_row.evidence) > 0, 'legacy evidence must be dual-written');

    DELETE FROM public.triage_attempts WHERE run_id = v_run_id;
    DELETE FROM public.triage_runs WHERE run_id = v_run_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 3) complete_triage_report retry disposition must satisfy reports_triage_status_chk.
DO $$
DECLARE
    v_report_id text := 'test-phase11-retry-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_run_id uuid;
    v_row public.reports%ROWTYPE;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Retry disposition contract test'
    );

    UPDATE public.reports
    SET triage_status = 'processing', triage_claimed_at = now()
    WHERE report_id = v_report_id;

    INSERT INTO public.triage_runs (report_id, prompt_version)
    VALUES (v_report_id, '1.0.0')
    RETURNING run_id INTO v_run_id;

    PERFORM public.complete_triage_report(
        p_report_id := v_report_id,
        p_analysis := NULL,
        p_disposition := 'retry',
        p_run_id := v_run_id,
        p_attempt_number := 1,
        p_model := 'test-model',
        p_prompt_version := '1.0.0',
        p_raw_output := '',
        p_latency_ms := 10,
        p_validation_errors := '[]'::jsonb,
        p_finish_run := false
    );

    SELECT * INTO v_row FROM public.reports WHERE report_id = v_report_id;

    PERFORM _test_assert(v_row.triage_status = 'retry', 'triage_status must be retry');
    PERFORM _test_assert(v_row.triage_claimed_at IS NULL, 'retry must clear triage_claimed_at');
    PERFORM _test_assert(
        v_row.triage_next_attempt_at IS NOT NULL,
        'retry must schedule triage_next_attempt_at'
    );
    PERFORM _test_assert(v_row.triage_attempt_count = 1, 'retry must increment triage_attempt_count');

    DELETE FROM public.triage_attempts WHERE run_id = v_run_id;
    DELETE FROM public.triage_runs WHERE run_id = v_run_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 4) chat_messages is service_role only; anon cannot read coach history.
DO $$
DECLARE
    v_report_id text := 'test-phase11-chat-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Coach contract fixture'
    );

    INSERT INTO public.chat_messages (report_id, role, content)
    VALUES (v_report_id, 'assistant', 'Coach reply fixture');

    BEGIN
        SET LOCAL ROLE anon;
        PERFORM 1 FROM public.chat_messages WHERE report_id = v_report_id LIMIT 1;
        RAISE EXCEPTION 'anon must not read chat_messages';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    DELETE FROM public.chat_messages WHERE report_id = v_report_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;
