-- Phase 7 Plan 12: migration-stage contract for legacy evidence removal.
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

DO $$
BEGIN
    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'reports'
              AND column_name = 'image_gcs_uri'
        ),
        'image_gcs_uri must be removed after migration'
    );

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'reports'
              AND column_name = 'evidence_path'
        ),
        'evidence_path must remain after migration'
    );

    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM public.reports
            WHERE evidence_path IS NULL
              AND report_id = 'demo-008-open-manhole'
        ),
        'retained evidence rows must have evidence_path'
    );
END;
$$;

DO $$
DECLARE
    v_report_id text := 'test-legacy-drop-' || gen_random_uuid()::text;
    v_token_hash text := repeat('b', 64);
BEGIN
    PERFORM public.create_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '30 days',
        p_evidence_path := 'evidence/reports/demo/evidence.png'
    );

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.reports
            WHERE report_id = v_report_id
              AND evidence_path = 'evidence/reports/demo/evidence.png'
        ),
        'create_report_with_access_token must persist evidence_path only'
    );

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;
