-- Phase 7 Plan 08: live contract tests for additive evidence_path column.
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

-- 1) evidence_path column exists and backfills supabase:// URIs.
DO $$
DECLARE
    v_report_id text := 'test-evidence-path-' || gen_random_uuid()::text;
BEGIN
    INSERT INTO public.reports (report_id, image_gcs_uri)
    VALUES (v_report_id, 'supabase://evidence/reports/demo/evidence.jpg');

    UPDATE public.reports
    SET evidence_path = regexp_replace(image_gcs_uri, '^supabase://', '')
    WHERE report_id = v_report_id
      AND evidence_path IS NULL;

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.reports
            WHERE report_id = v_report_id
              AND evidence_path = 'evidence/reports/demo/evidence.jpg'
        ),
        'evidence_path must backfill from supabase:// URI'
    );

    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 2) create_report_with_access_token writes evidence_path without dropping image_gcs_uri.
DO $$
DECLARE
    v_report_id text := 'test-evidence-rpc-' || gen_random_uuid()::text;
    v_token_hash text := repeat('a', 64);
BEGIN
    PERFORM public.create_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '30 days',
        p_description := 'Evidence path contract',
        p_image_gcs_uri := 'supabase://evidence/reports/demo/evidence.png',
        p_evidence_path := 'evidence/reports/demo/evidence.png'
    );

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.reports
            WHERE report_id = v_report_id
              AND evidence_path = 'evidence/reports/demo/evidence.png'
              AND image_gcs_uri = 'supabase://evidence/reports/demo/evidence.png'
        ),
        'RPC must persist both evidence_path and legacy image_gcs_uri'
    );

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 3) image_gcs_uri column remains present for rollback compatibility.
DO $$
BEGIN
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'reports'
              AND column_name = 'image_gcs_uri'
        ),
        'image_gcs_uri must remain for rollback compatibility'
    );
END;
$$;
