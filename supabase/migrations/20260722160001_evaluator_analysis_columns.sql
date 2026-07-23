-- Phase 11 Plan 01: additive evaluator 11-key columns on reports.

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS observed_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS inferences JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS unknowns JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS severity_reason TEXT,
    ADD COLUMN IF NOT EXISTS priority_reason TEXT,
    ADD COLUMN IF NOT EXISTS recommended_action TEXT,
    ADD COLUMN IF NOT EXISTS requires_human_review BOOLEAN NOT NULL DEFAULT true;
