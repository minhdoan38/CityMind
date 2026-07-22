-- Phase 9: routing columns + escalate RPC contract tests.
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

-- 1) Pending intake row has NULL routing_destination (government-visible default).
DO $$
DECLARE
    v_report_id text := 'test-routing-pending-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_row public.reports%ROWTYPE;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Routing pending intake test'
    );

    SELECT * INTO v_row FROM public.reports WHERE report_id = v_report_id;

    PERFORM _test_assert(v_row.triage_status = 'pending', 'intake triage_status must be pending');
    PERFORM _test_assert(v_row.routing_destination IS NULL, 'pending intake routing_destination must be NULL');

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 2) CHECK constraint rejects invalid routing_destination value.
DO $$
DECLARE
    v_report_id text := 'test-routing-check-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_rejected boolean := false;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Routing CHECK test'
    );

    BEGIN
        UPDATE public.reports
        SET routing_destination = 'invalid_destination'
        WHERE report_id = v_report_id;
    EXCEPTION
        WHEN check_violation THEN
            v_rejected := true;
    END;

    PERFORM _test_assert(v_rejected, 'invalid routing_destination must fail CHECK constraint');

    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 3) escalate_report_to_government flips self_help → government with audit note.
DO $$
DECLARE
    v_report_id text := 'test-routing-escalate-' || gen_random_uuid()::text;
    v_token_hash text := encode(digest(v_report_id, 'sha256'), 'hex');
    v_result jsonb;
    v_row public.reports%ROWTYPE;
    v_event_count integer;
BEGIN
    PERFORM public.create_intake_report_with_access_token(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash,
        p_token_expires_at := timezone('utc', now()) + interval '365 days',
        p_description := 'Routing escalate test'
    );

    UPDATE public.reports
    SET
        triage_status = 'completed',
        routing_destination = 'self_help',
        routing_reason = 'eligible_category_low_severity',
        routing_policy_version = '1.0.0',
        routed_at = timezone('utc', now()),
        category = 'pothole',
        severity = 2,
        current_status = 'new'
    WHERE report_id = v_report_id;

    v_result := public.escalate_report_to_government(
        p_report_id := v_report_id,
        p_token_hash := v_token_hash
    );

    PERFORM _test_assert((v_result ->> 'routing_destination') = 'government', 'escalate must return government destination');
    PERFORM _test_assert((v_result ->> 'updated')::boolean = true, 'escalate must report updated=true');

    SELECT * INTO v_row FROM public.reports WHERE report_id = v_report_id;
    PERFORM _test_assert(v_row.routing_destination = 'government', 'report routing_destination must be government');
    PERFORM _test_assert(v_row.routing_reason = 'citizen_escalated', 'routing_reason must be citizen_escalated');

    SELECT count(*) INTO v_event_count
    FROM public.status_events
    WHERE report_id = v_report_id
      AND note ILIKE '%escalated%';

    PERFORM _test_assert(v_event_count >= 1, 'escalate must append status_events note');

    DELETE FROM public.status_events WHERE report_id = v_report_id;
    DELETE FROM public.access_tokens WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 4) escalate_report_to_government is service_role-only.
DO $$
BEGIN
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.escalate_report_to_government(
            p_report_id := 'test-routing-anon-' || gen_random_uuid()::text,
            p_token_hash := encode(digest('anon-denied-escalate', 'sha256'), 'hex')
        );
        RESET ROLE;
        RAISE EXCEPTION 'anon must not execute escalate_report_to_government';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RESET ROLE;
    END;
END;
$$;

DROP FUNCTION IF EXISTS _test_assert(boolean, text);
