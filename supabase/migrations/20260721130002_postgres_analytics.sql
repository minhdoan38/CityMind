-- Phase 7 Plan 07: Postgres-backed officer/public analytics (SECURITY INVOKER views + RPCs)

CREATE INDEX IF NOT EXISTS reports_created_at_utc_date_idx
    ON public.reports ((DATE(created_at AT TIME ZONE 'UTC')));

CREATE INDEX IF NOT EXISTS status_events_close_lookup_idx
    ON public.status_events (report_id, created_at)
    WHERE status IN ('resolved', 'rejected');

CREATE OR REPLACE VIEW public.v_analytics_volume_daily
WITH (security_invoker = true) AS
SELECT
    DATE(created_at AT TIME ZONE 'UTC') AS day,
    COUNT(*)::integer AS report_count
FROM public.reports
GROUP BY 1;

CREATE OR REPLACE VIEW public.v_analytics_sla_closed
WITH (security_invoker = true) AS
WITH closed AS (
    SELECT
        report_id,
        MIN(created_at) AS closed_at
    FROM public.status_events
    WHERE status IN ('resolved', 'rejected')
    GROUP BY report_id
)
SELECT
    r.report_id,
    r.created_at AS opened_at,
    c.closed_at,
    (
        DATE(c.closed_at AT TIME ZONE 'UTC')
        - DATE(r.created_at AT TIME ZONE 'UTC')
    )::integer AS days_to_close
FROM public.reports r
INNER JOIN closed c USING (report_id);

CREATE OR REPLACE FUNCTION public.get_officer_analytics(
    p_date_from date,
    p_date_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_volume jsonb;
    v_category_mix jsonb;
    v_hotspots jsonb;
    v_sla_days jsonb;
BEGIN
    IF NOT public.is_officer_or_admin() THEN
        RAISE EXCEPTION 'officer required' USING ERRCODE = '42501';
    END IF;

    IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_from > p_date_to THEN
        RAISE EXCEPTION 'invalid date range';
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('day', day, 'report_count', report_count)
            ORDER BY day
        ),
        '[]'::jsonb
    )
    INTO v_volume
    FROM public.v_analytics_volume_daily
    WHERE day BETWEEN p_date_from AND p_date_to;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('category', category, 'report_count', report_count)
            ORDER BY report_count DESC, category
        ),
        '[]'::jsonb
    )
    INTO v_category_mix
    FROM (
        SELECT
            COALESCE(category, 'unknown') AS category,
            COUNT(*)::integer AS report_count
        FROM public.reports
        WHERE DATE(created_at AT TIME ZONE 'UTC') BETWEEN p_date_from AND p_date_to
        GROUP BY 1
    ) category_rows;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('category', category, 'report_count', report_count)
            ORDER BY report_count DESC, category
        ),
        '[]'::jsonb
    )
    INTO v_hotspots
    FROM (
        SELECT
            COALESCE(category, 'unknown') AS category,
            COUNT(*)::integer AS report_count
        FROM public.reports
        WHERE DATE(created_at AT TIME ZONE 'UTC') BETWEEN p_date_from AND p_date_to
        GROUP BY 1
        ORDER BY report_count DESC, category
        LIMIT 10
    ) hotspot_rows;

    SELECT COALESCE(jsonb_agg(days_to_close ORDER BY days_to_close), '[]'::jsonb)
    INTO v_sla_days
    FROM public.v_analytics_sla_closed
    WHERE DATE(closed_at AT TIME ZONE 'UTC') BETWEEN p_date_from AND p_date_to;

    RETURN jsonb_build_object(
        'volume', v_volume,
        'category_mix', v_category_mix,
        'hotspots', v_hotspots,
        'sla_days', v_sla_days
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH stats_window AS (
        SELECT
            (CURRENT_DATE - 29) AS date_from,
            CURRENT_DATE AS date_to
    ),
    totals AS (
        SELECT COUNT(*)::integer AS total
        FROM public.reports r
        CROSS JOIN stats_window w
        WHERE DATE(r.created_at AT TIME ZONE 'UTC') BETWEEN w.date_from AND w.date_to
    ),
    categories AS (
        SELECT
            COALESCE(category, 'unknown') AS category,
            COUNT(*)::integer AS cnt
        FROM public.reports r
        CROSS JOIN stats_window w
        WHERE DATE(r.created_at AT TIME ZONE 'UTC') BETWEEN w.date_from AND w.date_to
        GROUP BY 1
        HAVING COUNT(*) >= 3
        ORDER BY cnt DESC, category
        LIMIT 2
    )
    SELECT jsonb_build_object(
        'total_last_30d', COALESCE((SELECT total FROM totals), 0),
        'top_categories', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object('category', category, 'count', cnt)
                    ORDER BY cnt DESC, category
                )
                FROM categories
            ),
            '[]'::jsonb
        )
    );
$$;

REVOKE ALL ON FUNCTION public.get_officer_analytics(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_officer_analytics(date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO service_role;
