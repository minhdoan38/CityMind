-- Phase 7 Plan 07: live contract tests for Postgres analytics RPCs.
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

-- 1) Volume, category mix, hotspots, and SLA honor date filters.
DO $$
DECLARE
    v_prefix text := 'test-analytics-range-' || gen_random_uuid()::text;
    v_payload jsonb;
    v_volume jsonb;
    v_mix jsonb;
    v_hotspots jsonb;
    v_sla_days jsonb;
BEGIN
    INSERT INTO public.reports (report_id, created_at, category)
    VALUES
        (v_prefix || '-a', '2026-07-01T12:00:00Z', 'flooding'),
        (v_prefix || '-b', '2026-07-02T12:00:00Z', 'traffic'),
        (v_prefix || '-c', '2026-07-05T12:00:00Z', 'flooding'),
        (v_prefix || '-d', '2026-06-30T12:00:00Z', 'noise');

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', 'officer-analytics-user',
            'app_metadata', json_build_object('role', 'officer')
        )::text,
        true
    );

    v_payload := public.get_officer_analytics(DATE '2026-07-01', DATE '2026-07-03');
    v_volume := v_payload->'volume';
    v_mix := v_payload->'category_mix';
    v_hotspots := v_payload->'hotspots';
    v_sla_days := v_payload->'sla_days';

    PERFORM _test_assert(
        jsonb_array_length(v_volume) = 2,
        'volume must include only in-range days'
    );
    PERFORM _test_assert(
        EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_mix) elem
            WHERE elem->>'category' = 'flooding' AND (elem->>'report_count')::integer = 2
        ),
        'category mix must aggregate in-range categories'
    );
    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_mix) elem
            WHERE elem->>'category' = 'noise'
        ),
        'category mix must exclude out-of-range rows'
    );
    PERFORM _test_assert(
        jsonb_array_length(v_hotspots) >= 2,
        'hotspots must return ranked categories'
    );
    PERFORM _test_assert(
        jsonb_array_length(v_sla_days) = 0,
        'sla_days must be empty when no closes in range'
    );

    DELETE FROM public.status_events WHERE report_id LIKE v_prefix || '%';
    DELETE FROM public.reports WHERE report_id LIKE v_prefix || '%';
END;
$$;

-- 2) SLA uses earliest resolved/rejected close per report.
DO $$
DECLARE
    v_report_id text := 'test-analytics-sla-' || gen_random_uuid()::text;
    v_payload jsonb;
    v_days integer;
BEGIN
    INSERT INTO public.reports (report_id, created_at, category, current_status)
    VALUES (v_report_id, '2026-07-01T08:00:00Z', 'flooding', 'resolved');

    INSERT INTO public.status_events (report_id, status, created_at)
    VALUES
        (v_report_id, 'resolved', '2026-07-05T10:00:00Z'),
        (v_report_id, 'resolved', '2026-07-08T10:00:00Z'),
        (v_report_id, 'rejected', '2026-07-04T12:00:00Z');

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', 'officer-analytics-user',
            'app_metadata', json_build_object('role', 'officer')
        )::text,
        true
    );

    v_payload := public.get_officer_analytics(DATE '2026-07-01', DATE '2026-07-10');
    SELECT (elem)::integer
    INTO v_days
    FROM jsonb_array_elements_text(v_payload->'sla_days') elem
    LIMIT 1;

    PERFORM _test_assert(v_days = 3, 'sla must use earliest close event');

    DELETE FROM public.status_events WHERE report_id = v_report_id;
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

-- 3) Public stats enforce k>=3 category disclosure.
DO $$
DECLARE
    v_prefix text := 'test-public-stats-' || gen_random_uuid()::text;
    v_payload jsonb;
    v_categories jsonb;
BEGIN
    INSERT INTO public.reports (report_id, created_at, category)
    VALUES
        (v_prefix || '-1', timezone('utc', now()) - interval '1 day', 'pothole'),
        (v_prefix || '-2', timezone('utc', now()) - interval '2 day', 'pothole'),
        (v_prefix || '-3', timezone('utc', now()) - interval '3 day', 'pothole'),
        (v_prefix || '-4', timezone('utc', now()) - interval '4 day', 'lighting'),
        (v_prefix || '-5', timezone('utc', now()) - interval '5 day', 'lighting'),
        (v_prefix || '-6', timezone('utc', now()) - interval '6 day', 'graffiti'),
        (v_prefix || '-7', timezone('utc', now()) - interval '7 day', 'graffiti');

    v_payload := public.get_public_stats();
    v_categories := v_payload->'top_categories';

    PERFORM _test_assert(
        (v_payload->>'total_last_30d')::integer >= 7,
        'public stats must include recent totals'
    );
    PERFORM _test_assert(
        jsonb_array_length(v_categories) <= 2,
        'public stats must cap disclosed categories'
    );
    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_categories) elem
            WHERE (elem->>'count')::integer < 3
        ),
        'public stats must apply k>=3 threshold'
    );
    PERFORM _test_assert(
        NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_categories) elem
            WHERE elem->>'category' = 'graffiti'
        ),
        'public stats must omit under-threshold categories'
    );

    DELETE FROM public.reports WHERE report_id LIKE v_prefix || '%';
END;
$$;

-- 4) Anonymous callers cannot invoke officer analytics.
DO $$
BEGIN
    PERFORM set_config('request.jwt.claims', NULL, true);

    BEGIN
        PERFORM public.get_officer_analytics(DATE '2026-07-01', DATE '2026-07-03');
        PERFORM _test_assert(false, 'anonymous must not call officer analytics');
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%officer required%' THEN
                RAISE;
            END IF;
    END;
END;
$$;
