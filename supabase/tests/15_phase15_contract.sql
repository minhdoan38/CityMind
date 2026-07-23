-- Phase 15: Hanoi classifier columns and chat_messages FK contract tests.
-- Run in Supabase SQL Editor or:
--   node scripts/run-supabase-sql.mjs -f supabase/tests/15_phase15_contract.sql
--
-- Prerequisite: migration 20260723120001_hanoi_analysis_columns.sql applied.

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

-- 1) reports table exposes Hanoi v5.2 classifier columns.
DO $$
DECLARE
    v_missing text[];
    v_required text[] := ARRAY[
        'guidance_code',
        'handling_type',
        'handling_label',
        'severity_label',
        'critical_alert',
        'matched_known_issue',
        'allowed_actions',
        'prohibited_actions'
    ];
    v_col text;
BEGIN
    FOREACH v_col IN ARRAY v_required
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'reports'
              AND column_name = v_col
        ) THEN
            v_missing := array_append(v_missing, v_col);
        END IF;
    END LOOP;

    PERFORM _test_assert(
        v_missing IS NULL OR cardinality(v_missing) = 0,
        'reports missing Hanoi columns: ' || coalesce(array_to_string(v_missing, ', '), '(none checked)')
    );
END;
$$;

-- 2) chat_messages.report_id references reports(report_id).
DO $$
DECLARE
    v_fk_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'chat_messages'
          AND c.contype = 'f'
          AND pg_get_constraintdef(c.oid) LIKE '%FOREIGN KEY (report_id)%REFERENCES reports(report_id)%'
    )
    INTO v_fk_exists;

    PERFORM _test_assert(
        v_fk_exists,
        'chat_messages.report_id must reference public.reports(report_id)'
    );
END;
$$;

-- 3) Fixture report with Hanoi fields is readable via service_role context.
DO $$
DECLARE
    v_report_id text := 'test-phase15-hanoi-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_guidance_code text;
    v_handling_type smallint;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Phase 15 Hanoi column fixture'
    );

    UPDATE public.reports
    SET
        guidance_code = 'LITTER_BIN_NEARBY',
        handling_type = 1,
        handling_label = 'Self-guidance',
        severity_label = 'low',
        critical_alert = false,
        matched_known_issue = true,
        allowed_actions = '["Use nearby bin"]'::jsonb,
        prohibited_actions = '["Do not block traffic"]'::jsonb
    WHERE report_id = v_report_id;

    SELECT guidance_code, handling_type
    INTO v_guidance_code, v_handling_type
    FROM public.reports
    WHERE report_id = v_report_id;

    PERFORM _test_assert(v_guidance_code = 'LITTER_BIN_NEARBY', 'guidance_code must persist on reports');
    PERFORM _test_assert(v_handling_type = 1, 'handling_type must persist on reports');

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;
