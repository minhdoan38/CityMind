-- Phase 7 Plan 04: live contract tests for atomic report/token RPC and private evidence invariants.
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

-- 1) Successful atomic create_report_with_access_token persists both rows.
DO $$
DECLARE
    v_report_id text := 'test-contract-success-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
BEGIN
    PERFORM public.create_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Contract test report',
        p_category := 'infrastructure',
        p_severity := 3,
        p_confidence := 0.8,
        p_summary := 'Test summary',
        p_recommendation := 'Advisory recommendation',
        p_priority := 'medium',
        p_estimated_impact := 'localized'
    );

    PERFORM _test_assert(
        EXISTS (SELECT 1 FROM public.reports WHERE report_id = v_report_id),
        'report row must exist after atomic RPC'
    );
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.access_tokens
            WHERE report_id = v_report_id AND token_hash = v_token_hash
        ),
        'access token hash row must exist after atomic RPC'
    );

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 2) Forced token insert failure rolls back the report row.
DO $$
DECLARE
    v_existing_report text := 'test-contract-dup-existing-' || gen_random_uuid()::text;
    v_new_report text := 'test-contract-dup-new-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest('duplicate-token-seed', 'sha256'), 'hex');
BEGIN
    INSERT INTO public.reports (report_id, current_status)
    VALUES (v_existing_report, 'new');

    INSERT INTO public.access_tokens (token_hash, report_id, expires_at)
    VALUES (v_token_hash, v_existing_report, timezone('utc', now()) + interval '365 days');

    BEGIN
        PERFORM public.create_report_with_access_token(
            p_report_id := v_new_report,
            p_token_hash := v_token_hash,
            p_token_expires_at := timezone('utc', now()) + interval '365 days',
            p_description := 'Should roll back'
        );
        RAISE EXCEPTION 'expected duplicate token_hash failure';
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;

    PERFORM _test_assert(
        NOT EXISTS (SELECT 1 FROM public.reports WHERE report_id = v_new_report),
        'forced token failure must not leave a report row'
    );

    DELETE FROM public.access_tokens WHERE report_id = v_existing_report;
    DELETE FROM public.reports WHERE report_id = v_existing_report;
END;
$$;

-- 3) Anonymous role cannot read access_tokens.
DO $$
BEGIN
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM count(*)::integer FROM public.access_tokens;
        RESET ROLE;
        RAISE EXCEPTION 'anon must not read access_tokens';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
    END;
END;
$$;

-- 4) Authenticated non-officer cannot read access_tokens.
DO $$
BEGIN
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM set_config(
            'request.jwt.claims',
            '{"app_metadata":{"role":"citizen"}}',
            true
        );
        PERFORM count(*)::integer FROM public.access_tokens;
        RESET ROLE;
        RAISE EXCEPTION 'non-officer authenticated must not read access_tokens';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
    END;
END;
$$;

-- 5) Evidence bucket remains private with expected limits.
DO $$
DECLARE
    v_bucket record;
BEGIN
    SELECT id, public, file_size_limit, allowed_mime_types
    INTO v_bucket
    FROM storage.buckets
    WHERE id = 'evidence';

    PERFORM _test_assert(v_bucket.id = 'evidence', 'evidence bucket must exist');
    PERFORM _test_assert(v_bucket.public = false, 'evidence bucket must stay private');
    PERFORM _test_assert(v_bucket.file_size_limit = 10485760, 'evidence bucket size limit must be 10 MiB');
    PERFORM _test_assert(
        v_bucket.allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[],
        'evidence bucket must allow JPEG/PNG/WebP only'
    );
END;
$$;

-- 6) Broad anonymous evidence insert policy must be removed.
DO $$
BEGIN
    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'storage'
              AND tablename = 'objects'
              AND policyname = 'insert_evidence_public'
        ),
        'insert_evidence_public policy must be removed'
    );
END;
$$;

-- 7) create_report_with_access_token is service_role-only.
DO $$
BEGIN
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.create_report_with_access_token(
            p_report_id := 'test-contract-anon-' || gen_random_uuid()::text,
            p_token_hash := encode(digest('anon-denied', 'sha256'), 'hex'),
            p_token_expires_at := timezone('utc', now()) + interval '365 days'
        );
        RESET ROLE;
        RAISE EXCEPTION 'anon must not execute create_report_with_access_token';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
    END;
END;
$$;

DROP FUNCTION IF EXISTS _test_assert(boolean, text);
