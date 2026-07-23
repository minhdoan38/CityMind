-- Phase 16: secure evidence image pipeline contract tests.
-- Run in Supabase SQL Editor or:
--   node scripts/run-supabase-sql.mjs -f supabase/tests/16_phase16_contract.sql
--
-- Prerequisite: migration 20260723160001_phase16_evidence_bucket_invariants.sql applied.

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
DECLARE
    v_bucket record;
BEGIN
    SELECT id, public, file_size_limit, allowed_mime_types
    INTO v_bucket
    FROM storage.buckets
    WHERE id = 'evidence';

    PERFORM _test_assert(v_bucket.id IS NOT NULL, 'evidence bucket must exist');
    PERFORM _test_assert(v_bucket.public IS FALSE, 'evidence bucket must remain private');
    PERFORM _test_assert(
        v_bucket.file_size_limit = 10485760,
        'evidence bucket file_size_limit must be 10485760'
    );
    PERFORM _test_assert(
        'image/webp' = ANY (v_bucket.allowed_mime_types),
        'evidence bucket must allow image/webp'
    );
    PERFORM _test_assert(
        'image/jpeg' = ANY (v_bucket.allowed_mime_types),
        'evidence bucket must allow image/jpeg'
    );
    PERFORM _test_assert(
        'image/png' = ANY (v_bucket.allowed_mime_types),
        'evidence bucket must allow image/png'
    );
END;
$$;

DO $$
BEGIN
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'reports_evidence_path_format_chk'
        ),
        'reports_evidence_path_format_chk must exist'
    );
END;
$$;

DO $$
BEGIN
    PERFORM _test_assert(
        'evidence/reports/test-id/550e8400-e29b-41d4-a716-446655440000.webp'
            ~ '^[^/]+/.+',
        'sample UUID WebP evidence_path must satisfy format check'
    );
END;
$$;
