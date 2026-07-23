-- Phase 11 Plan 01: complete_triage_report v2 — persist 11-key evaluator shape + legacy dual-write.

CREATE OR REPLACE FUNCTION public.complete_triage_report(
    p_report_id text,
    p_analysis jsonb,
    p_disposition text,
    p_run_id uuid,
    p_attempt_number integer,
    p_model text,
    p_prompt_version text,
    p_raw_output text,
    p_latency_ms integer,
    p_validation_errors jsonb DEFAULT '[]'::jsonb,
    p_finish_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run_id uuid := p_run_id;
    v_observed_facts jsonb;
    v_inferences jsonb;
    v_unknowns jsonb;
    v_severity_reason text;
    v_priority_reason text;
    v_recommended_action text;
    v_requires_human_review boolean;
    v_summary text;
    v_recommendation text;
    v_estimated_impact text;
    v_evidence jsonb;
    v_uncertainty jsonb;
BEGIN
    IF p_report_id IS NULL OR btrim(p_report_id) = '' THEN
        RAISE EXCEPTION 'report_id is required';
    END IF;

    IF v_run_id IS NULL THEN
        INSERT INTO public.triage_runs (report_id, prompt_version, final_disposition)
        VALUES (p_report_id, COALESCE(p_prompt_version, 'unknown'), NULL)
        RETURNING run_id INTO v_run_id;
    END IF;

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
        COALESCE(p_attempt_number, 1),
        p_model,
        p_prompt_version,
        p_raw_output,
        p_latency_ms,
        COALESCE(p_validation_errors, '[]'::jsonb),
        p_disposition
    );

    IF p_disposition = 'completed' AND p_analysis IS NOT NULL THEN
        v_observed_facts := COALESCE(
            p_analysis->'observed_facts',
            p_analysis->'evidence',
            '[]'::jsonb
        );
        v_inferences := COALESCE(p_analysis->'inferences', '[]'::jsonb);
        v_unknowns := COALESCE(
            p_analysis->'unknowns',
            p_analysis->'uncertainty',
            '[]'::jsonb
        );
        v_severity_reason := COALESCE(
            p_analysis->>'severity_reason',
            p_analysis->>'summary'
        );
        v_priority_reason := COALESCE(
            p_analysis->>'priority_reason',
            p_analysis->>'estimated_impact'
        );
        v_recommended_action := COALESCE(
            p_analysis->>'recommended_action',
            p_analysis->>'recommendation'
        );
        v_requires_human_review := COALESCE(
            (p_analysis->>'requires_human_review')::boolean,
            true
        );
        v_summary := COALESCE(
            p_analysis->>'summary',
            v_severity_reason,
            NULLIF(
                (
                    SELECT string_agg(value, ' ')
                    FROM jsonb_array_elements_text(v_observed_facts) AS value
                ),
                ''
            )
        );
        v_recommendation := COALESCE(v_recommended_action, p_analysis->>'recommendation');
        v_estimated_impact := COALESCE(
            p_analysis->>'estimated_impact',
            v_priority_reason,
            'Impact assessment pending officer review.'
        );
        v_evidence := COALESCE(p_analysis->'evidence', v_observed_facts, '[]'::jsonb);
        v_uncertainty := COALESCE(p_analysis->'uncertainty', v_unknowns, '[]'::jsonb);

        UPDATE public.reports
        SET
            category = p_analysis->>'category',
            severity = (p_analysis->>'severity')::integer,
            confidence = (p_analysis->>'confidence')::double precision,
            observed_facts = v_observed_facts,
            inferences = v_inferences,
            unknowns = v_unknowns,
            severity_reason = v_severity_reason,
            priority_reason = v_priority_reason,
            recommended_action = v_recommended_action,
            requires_human_review = v_requires_human_review,
            summary = v_summary,
            recommendation = v_recommendation,
            priority = p_analysis->>'priority',
            estimated_impact = v_estimated_impact,
            evidence = v_evidence,
            uncertainty = v_uncertainty,
            triage_status = 'completed',
            triaged_at = timezone('utc', now()),
            triage_claimed_at = NULL,
            triage_error = NULL,
            triage_next_attempt_at = NULL
        WHERE report_id = p_report_id;
    ELSE
        UPDATE public.reports
        SET
            triage_status = p_disposition,
            triaged_at = CASE
                WHEN p_disposition IN ('manual_review', 'failed') THEN timezone('utc', now())
                ELSE triaged_at
            END,
            triage_claimed_at = NULL,
            triage_next_attempt_at = CASE
                WHEN p_disposition = 'retry' THEN timezone('utc', now()) + interval '30 seconds'
                ELSE triage_next_attempt_at
            END,
            triage_attempt_count = CASE
                WHEN p_disposition = 'retry' THEN triage_attempt_count + 1
                ELSE triage_attempt_count
            END
        WHERE report_id = p_report_id;
    END IF;

    IF p_finish_run THEN
        UPDATE public.triage_runs
        SET
            finished_at = timezone('utc', now()),
            final_disposition = p_disposition
        WHERE run_id = v_run_id;
    END IF;

    RETURN jsonb_build_object('run_id', v_run_id, 'report_id', p_report_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_triage_report(
    text, jsonb, text, uuid, integer, text, text, text, integer, jsonb, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_triage_report(
    text, jsonb, text, uuid, integer, text, text, text, integer, jsonb, boolean
) TO service_role;
