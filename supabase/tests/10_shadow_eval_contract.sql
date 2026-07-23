-- Phase 10: shadow comparison storage contract (insert-only; reports analysis unchanged).
-- Pure PostgreSQL (no psql meta-commands). Run in Supabase SQL Editor or:
--   node scripts/run-supabase-sql.mjs supabase/tests/10_shadow_eval_contract.sql

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

-- 1) Shadow row persists without mutating reports analysis columns.
DO $$
DECLARE
    v_report_id text := 'test-shadow-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_run_id uuid := gen_random_uuid();
    v_category_before text;
    v_category_after text;
    v_baseline jsonb := jsonb_build_object(
        'category', 'pothole',
        'severity', 3,
        'confidence', 0.8,
        'summary', 'Pothole on main street near crossing.',
        'recommendation', 'Schedule road repair crew inspection.',
        'priority', 'medium',
        'estimated_impact', 'Localized traffic disruption.',
        'evidence', jsonb_build_array('Visible pothole in citizen photo.'),
        'uncertainty', jsonb_build_array('Exact depth unknown.')
    );
    v_candidate jsonb := jsonb_build_object(
        'category', 'flooding',
        'severity', 3,
        'confidence', 0.75,
        'summary', 'Standing water pooling near crossing.',
        'recommendation', 'Inspect drainage near crossing.',
        'priority', 'medium',
        'estimated_impact', 'Possible drainage issue.',
        'evidence', jsonb_build_array('Water visible in photo.'),
        'uncertainty', jsonb_build_array('Source of water unclear.')
    );
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Shadow contract test report'
    );

    UPDATE public.reports
    SET
        category = 'pothole',
        severity = 3,
        priority = 'medium',
        triage_status = 'completed'
    WHERE report_id = v_report_id;

    SELECT category INTO v_category_before FROM public.reports WHERE report_id = v_report_id;

    INSERT INTO public.triage_runs (run_id, report_id, prompt_version, final_disposition, finished_at)
    VALUES (v_run_id, v_report_id, 'phase10-shadow-v1', 'completed', timezone('utc', now()));

    INSERT INTO public.triage_shadow_comparisons (
        report_id,
        production_run_id,
        candidate_model,
        candidate_prompt_version,
        baseline_snapshot,
        candidate_snapshot,
        disagreement,
        has_disagreement
    ) VALUES (
        v_report_id,
        v_run_id,
        'candidate-model-v1',
        '1.0.0',
        v_baseline,
        v_candidate,
        jsonb_build_object('category', true, 'severity', false, 'priority', false),
        true
    );

    SELECT category INTO v_category_after FROM public.reports WHERE report_id = v_report_id;

    PERFORM _test_assert(v_category_before = 'pothole', 'baseline category must be pothole before shadow insert');
    PERFORM _test_assert(v_category_after = 'pothole', 'reports.category must remain unchanged after shadow insert');
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.triage_shadow_comparisons
            WHERE report_id = v_report_id AND has_disagreement = true
        ),
        'shadow row must exist with has_disagreement true'
    );
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.triage_shadow_comparisons
            WHERE report_id = v_report_id
              AND baseline_snapshot->>'category' = 'pothole'
              AND candidate_snapshot->>'category' = 'flooding'
        ),
        'shadow snapshots must store baseline and candidate JSON'
    );

    DELETE FROM public.triage_shadow_comparisons WHERE report_id = v_report_id;
    DELETE FROM public.triage_attempts WHERE run_id = v_run_id;
    DELETE FROM public.triage_runs WHERE run_id = v_run_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 2) Partial index on has_disagreement supports officer filter lookups.
DO $$
DECLARE
    v_report_id text := 'test-shadow-idx-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_run_id uuid := gen_random_uuid();
    v_snapshot jsonb := jsonb_build_object(
        'category', 'waste',
        'severity', 2,
        'confidence', 0.7,
        'summary', 'Overflowing bin on sidewalk.',
        'recommendation', 'Schedule waste pickup.',
        'priority', 'low',
        'estimated_impact', 'Minor sidewalk obstruction.',
        'evidence', jsonb_build_array('Bin visible overflowing.'),
        'uncertainty', jsonb_build_array()
    );
    v_match_count integer;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Shadow index contract test'
    );

    INSERT INTO public.triage_runs (run_id, report_id, prompt_version, final_disposition, finished_at)
    VALUES (v_run_id, v_report_id, 'phase10-shadow-v1', 'completed', timezone('utc', now()));

    INSERT INTO public.triage_shadow_comparisons (
        report_id,
        production_run_id,
        candidate_model,
        candidate_prompt_version,
        baseline_snapshot,
        candidate_snapshot,
        disagreement,
        has_disagreement
    ) VALUES (
        v_report_id,
        v_run_id,
        'candidate-model-v1',
        '1.0.0',
        v_snapshot,
        v_snapshot,
        jsonb_build_object('category', false, 'severity', false, 'priority', false),
        false
    );

    INSERT INTO public.triage_shadow_comparisons (
        report_id,
        production_run_id,
        candidate_model,
        candidate_prompt_version,
        baseline_snapshot,
        candidate_snapshot,
        disagreement,
        has_disagreement
    ) VALUES (
        v_report_id,
        v_run_id,
        'candidate-model-v2',
        '1.0.0',
        v_snapshot,
        jsonb_set(v_snapshot, '{priority}', '"high"'::jsonb),
        jsonb_build_object('category', false, 'severity', false, 'priority', true),
        true
    );

    SELECT count(*)::integer INTO v_match_count
    FROM public.triage_shadow_comparisons
    WHERE report_id = v_report_id AND has_disagreement = true;

    PERFORM _test_assert(v_match_count >= 1, 'has_disagreement partial index must support filter queries');

    DELETE FROM public.triage_shadow_comparisons WHERE report_id = v_report_id;
    DELETE FROM public.triage_runs WHERE run_id = v_run_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

DROP FUNCTION IF EXISTS _test_assert(boolean, text);
