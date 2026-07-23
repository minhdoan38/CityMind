-- Phase 12: officer assistant message persistence contract tests.
-- Run in Supabase SQL Editor or:
--   node scripts/run-supabase-sql.mjs -f supabase/tests/12_phase12_contract.sql
--
-- Prerequisite (run first if table is missing):
--   node scripts/run-supabase-sql.mjs -f supabase/migrations/20260722170001_officer_assistant_messages.sql
-- Or paste supabase/migrations/20260722170001_officer_assistant_messages.sql into SQL Editor.

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
    IF to_regclass('public.officer_assistant_messages') IS NULL THEN
        RAISE EXCEPTION
            'Missing public.officer_assistant_messages. Apply migration 20260722170001_officer_assistant_messages.sql before this contract test.';
    END IF;
END;
$$;

-- officer_assistant_messages is service_role only; anon and authenticated cannot read.
DO $$
DECLARE
    v_officer_id uuid := gen_random_uuid();
    v_message_id uuid;
BEGIN
    INSERT INTO public.officer_assistant_messages (officer_user_id, role, content)
    VALUES (v_officer_id, 'assistant', 'Officer assistant fixture')
    RETURNING message_id INTO v_message_id;

    BEGIN
        SET LOCAL ROLE anon;
        PERFORM 1 FROM public.officer_assistant_messages WHERE message_id = v_message_id LIMIT 1;
        RAISE EXCEPTION 'anon must not read officer_assistant_messages';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM 1 FROM public.officer_assistant_messages WHERE message_id = v_message_id LIMIT 1;
        RAISE EXCEPTION 'authenticated must not read officer_assistant_messages';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    DELETE FROM public.officer_assistant_messages WHERE message_id = v_message_id;
END;
$$;
