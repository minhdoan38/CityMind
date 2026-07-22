-- Phase 7 Plan 06: atomic officer status update RPC.

CREATE OR REPLACE FUNCTION public.update_report_with_status_event(
    p_report_id text,
    p_status text,
    p_note text,
    p_actor_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_officer_or_admin() THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    IF p_report_id IS NULL OR btrim(p_report_id) = '' THEN
        RAISE EXCEPTION 'report_id is required';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('new', 'reviewing', 'resolved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    IF p_status IN ('resolved', 'rejected')
        AND (p_note IS NULL OR btrim(p_note) = '') THEN
        RAISE EXCEPTION 'Note is required for resolved/rejected';
    END IF;

    IF p_actor_id IS NULL OR p_actor_id <> (auth.jwt() ->> 'sub') THEN
        RAISE EXCEPTION 'Invalid actor';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.reports WHERE report_id = p_report_id
    ) THEN
        RAISE EXCEPTION 'Report not found';
    END IF;

    UPDATE public.reports
    SET current_status = p_status
    WHERE report_id = p_report_id;

    INSERT INTO public.status_events (
        report_id,
        status,
        note,
        actor_id
    ) VALUES (
        p_report_id,
        p_status,
        NULLIF(btrim(p_note), ''),
        p_actor_id
    );

    RETURN jsonb_build_object(
        'report_id', p_report_id,
        'status', p_status,
        'updated', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_report_with_status_event(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_report_with_status_event(text, text, text, text) TO authenticated;
