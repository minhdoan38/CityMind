-- Phase 8 Plan 04: triage audit tables and complete_triage_report RPC.

CREATE TABLE IF NOT EXISTS public.triage_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    finished_at TIMESTAMPTZ,
    final_disposition TEXT,
    prompt_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.triage_attempts (
    attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.triage_runs(run_id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    model TEXT,
    prompt_version TEXT,
    raw_output TEXT,
    latency_ms INTEGER,
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    disposition TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS triage_runs_report_id_idx ON public.triage_runs(report_id);
CREATE INDEX IF NOT EXISTS triage_attempts_run_id_idx ON public.triage_attempts(run_id);

ALTER TABLE public.triage_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.triage_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.triage_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.triage_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.triage_attempts TO service_role;

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
        UPDATE public.reports
        SET
            category = p_analysis->>'category',
            severity = (p_analysis->>'severity')::integer,
            confidence = (p_analysis->>'confidence')::double precision,
            summary = p_analysis->>'summary',
            recommendation = p_analysis->>'recommendation',
            priority = p_analysis->>'priority',
            estimated_impact = p_analysis->>'estimated_impact',
            evidence = COALESCE(p_analysis->'evidence', '[]'::jsonb),
            uncertainty = COALESCE(p_analysis->'uncertainty', '[]'::jsonb),
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
