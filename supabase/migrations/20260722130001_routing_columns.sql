-- Phase 9 Plan 01: routing destination audit columns and citizen escalate RPC.

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS routing_destination TEXT,
    ADD COLUMN IF NOT EXISTS routing_reason TEXT,
    ADD COLUMN IF NOT EXISTS routing_policy_version TEXT,
    ADD COLUMN IF NOT EXISTS routed_at TIMESTAMPTZ;

ALTER TABLE public.reports
    DROP CONSTRAINT IF EXISTS reports_routing_destination_chk;

ALTER TABLE public.reports
    ADD CONSTRAINT reports_routing_destination_chk
    CHECK (
        routing_destination IS NULL
        OR routing_destination IN ('self_help', 'government')
    );

CREATE INDEX IF NOT EXISTS reports_routing_destination_idx
    ON public.reports (routing_destination)
    WHERE routing_destination IS NOT NULL;

-- Token-validated citizen escalate: self_help → government with audit note.
CREATE OR REPLACE FUNCTION public.escalate_report_to_government(
    p_report_id text,
    p_token_hash text,
    p_reason text DEFAULT 'citizen_escalated'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.reports%ROWTYPE;
BEGIN
    IF p_report_id IS NULL OR btrim(p_report_id) = '' THEN
        RAISE EXCEPTION 'report_id is required';
    END IF;

    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'token_hash must be a 64-character lowercase hex SHA-256 digest';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.access_tokens
        WHERE report_id = p_report_id
          AND token_hash = p_token_hash
          AND expires_at > timezone('utc', now())
    ) THEN
        RAISE EXCEPTION 'invalid or expired access token';
    END IF;

    SELECT * INTO v_row
    FROM public.reports
    WHERE report_id = p_report_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report not found';
    END IF;

    IF v_row.routing_destination IS DISTINCT FROM 'self_help' THEN
        RETURN jsonb_build_object(
            'report_id', p_report_id,
            'routing_destination', COALESCE(v_row.routing_destination, 'government'),
            'updated', false
        );
    END IF;

    UPDATE public.reports
    SET
        routing_destination = 'government',
        routing_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'citizen_escalated'),
        routed_at = timezone('utc', now())
    WHERE report_id = p_report_id;

    INSERT INTO public.status_events (
        report_id,
        status,
        note
    ) VALUES (
        p_report_id,
        v_row.current_status,
        'Citizen escalated report from self-help to government queue.'
    );

    RETURN jsonb_build_object(
        'report_id', p_report_id,
        'routing_destination', 'government',
        'updated', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.escalate_report_to_government(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.escalate_report_to_government(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.escalate_report_to_government(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_report_to_government(text, text, text) TO service_role;
