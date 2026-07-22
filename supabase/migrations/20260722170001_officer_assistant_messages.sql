-- Phase 12 Plan 01: officer-scoped advisory assistant message persistence.

CREATE TABLE IF NOT EXISTS public.officer_assistant_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_user_id UUID NOT NULL,
    report_id TEXT NULL REFERENCES public.reports(report_id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    model TEXT,
    latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS officer_assistant_messages_officer_user_id_created_at_idx
    ON public.officer_assistant_messages (officer_user_id, created_at);

ALTER TABLE public.officer_assistant_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.officer_assistant_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.officer_assistant_messages TO service_role;
