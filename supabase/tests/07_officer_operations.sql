-- Phase 7 Plan 06: live contract tests for atomic officer status RPC.
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

-- 1) Successful status update persists report current_status and status_events row.
DO $$
DECLARE
    v_report_id text := 'test-officer-status-' || gen_random_uuid()::text;
BEGIN
    INSERT INTO public.reports (report_id, current_status, summary)
    VALUES (v_report_id, 'new', 'Officer ops contract');

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', 'officer-contract-user',
            'app_metadata', json_build_object('role', 'officer')
        )::text,
        true
    );

    PERFORM public.update_report_with_status_event(
        p_report_id := v_report_id,
        p_status := 'reviewing',
        p_note := NULL,
        p_actor_id := 'officer-contract-user'
    );

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.reports
            WHERE report_id = v_report_id AND current_status = 'reviewing'
        ),
        'report current_status must update atomically'
    );
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.status_events
            WHERE report_id = v_report_id
              AND status = 'reviewing'
              AND actor_id = 'officer-contract-user'
        ),
        'status event must be inserted with actor_id'
    );

    DELETE FROM public.status_events WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 2) resolved without note is rejected.
DO $$
DECLARE
    v_report_id text := 'test-officer-note-' || gen_random_uuid()::text;
BEGIN
    INSERT INTO public.reports (report_id, current_status)
    VALUES (v_report_id, 'reviewing');

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', 'officer-contract-user',
            'app_metadata', json_build_object('role', 'officer')
        )::text,
        true
    );

    BEGIN
        PERFORM public.update_report_with_status_event(
            p_report_id := v_report_id,
            p_status := 'resolved',
            p_note := '   ',
            p_actor_id := 'officer-contract-user'
        );
        RAISE EXCEPTION 'expected note-required failure';
    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.reports
            WHERE report_id = v_report_id AND current_status = 'reviewing'
        ),
        'report status must not change when note validation fails'
    );
    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM public.status_events
            WHERE report_id = v_report_id AND status = 'resolved'
        ),
        'status event must not be inserted when note validation fails'
    );

    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 3) actor_id must match JWT sub.
DO $$
DECLARE
    v_report_id text := 'test-officer-actor-' || gen_random_uuid()::text;
BEGIN
    INSERT INTO public.reports (report_id, current_status)
    VALUES (v_report_id, 'new');

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', 'officer-contract-user',
            'app_metadata', json_build_object('role', 'officer')
        )::text,
        true
    );

    BEGIN
        PERFORM public.update_report_with_status_event(
            p_report_id := v_report_id,
            p_status := 'reviewing',
            p_note := NULL,
            p_actor_id := 'spoofed-actor'
        );
        RAISE EXCEPTION 'expected actor mismatch failure';
    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;

    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM public.reports
            WHERE report_id = v_report_id AND current_status = 'new'
        ),
        'report status must remain unchanged when actor_id is spoofed'
    );

    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 4) Non-officer JWT is denied.
DO $$
DECLARE
    v_report_id text := 'test-officer-deny-' || gen_random_uuid()::text;
BEGIN
    INSERT INTO public.reports (report_id, current_status)
    VALUES (v_report_id, 'new');

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', 'citizen-user',
            'app_metadata', json_build_object('role', 'citizen')
        )::text,
        true
    );

    BEGIN
        PERFORM public.update_report_with_status_event(
            p_report_id := v_report_id,
            p_status := 'reviewing',
            p_note := NULL,
            p_actor_id := 'citizen-user'
        );
        RAISE EXCEPTION 'expected non-officer denial';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%not authorized%' THEN
                RAISE;
            END IF;
    END;

    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM public.status_events
            WHERE report_id = v_report_id
        ),
        'non-officer must not insert status events'
    );

    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;
