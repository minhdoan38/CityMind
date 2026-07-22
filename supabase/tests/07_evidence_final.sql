-- Phase 7 Plan 12/15: durable post-cutover evidence_path and RLS contract.
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
        'legacy image_gcs_uri column must not exist'
    );

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'reports_evidence_path_format_chk'
        ),
        'evidence_path format constraint must exist'
    );
END;
$$;

DO $$
BEGIN
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM storage.buckets
            WHERE id = 'evidence'
              AND public = false
        ),
        'evidence bucket must remain private'
    );
END;
$$;
