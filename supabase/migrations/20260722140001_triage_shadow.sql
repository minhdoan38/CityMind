-- Phase 10 Plan 02: shadow triage comparison storage (baseline vs candidate, non-mutating).

CREATE TABLE IF NOT EXISTS public.triage_shadow_comparisons (
    comparison_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    production_run_id UUID NOT NULL REFERENCES public.triage_runs(run_id) ON DELETE CASCADE,
    candidate_model TEXT NOT NULL,
    candidate_prompt_version TEXT NOT NULL,
    baseline_snapshot JSONB NOT NULL,
    candidate_snapshot JSONB,
    disagreement JSONB NOT NULL DEFAULT '{}'::jsonb,
    has_disagreement BOOLEAN NOT NULL DEFAULT false,
    compared_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS triage_shadow_comparisons_report_id_idx
    ON public.triage_shadow_comparisons(report_id);

CREATE INDEX IF NOT EXISTS triage_shadow_comparisons_has_disagreement_idx
    ON public.triage_shadow_comparisons(has_disagreement)
    WHERE has_disagreement = true;

ALTER TABLE public.triage_shadow_comparisons ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.triage_shadow_comparisons FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.triage_shadow_comparisons TO service_role;
