-- Fix create_intake_report_with_access_token after Phase 7 dropped image_gcs_uri.
-- Phase 8 intake migration incorrectly still inserted into the removed column.

CREATE OR REPLACE FUNCTION public.create_intake_report_with_access_token(
    p_report_id text,
    p_token_hash text,
    p_token_expires_at timestamptz,
    p_description text DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_longitude double precision DEFAULT NULL,
    p_evidence_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_report_id IS NULL OR btrim(p_report_id) = '' THEN
        RAISE EXCEPTION 'report_id is required';
    END IF;

    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'token_hash must be a 64-character lowercase hex SHA-256 digest';
    END IF;

    IF p_token_expires_at IS NULL THEN
        RAISE EXCEPTION 'token_expires_at is required';
    END IF;

    INSERT INTO public.reports (
        report_id,
        description,
        latitude,
        longitude,
        category,
        severity,
        confidence,
        summary,
        recommendation,
        priority,
        estimated_impact,
        evidence,
        uncertainty,
        urban_context,
        evidence_path,
        current_status,
        triage_status
    ) VALUES (
        p_report_id,
        p_description,
        p_latitude,
        p_longitude,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        '[]'::jsonb,
        '[]'::jsonb,
        NULL,
        p_evidence_path,
        'new',
        'pending'
    );

    INSERT INTO public.access_tokens (
        token_hash,
        report_id,
        expires_at
    ) VALUES (
        p_token_hash,
        p_report_id,
        p_token_expires_at
    );

    RETURN jsonb_build_object(
        'report_id', p_report_id,
        'triage_status', 'pending'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_intake_report_with_access_token(
    text, text, timestamptz, text, double precision, double precision, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_intake_report_with_access_token(
    text, text, timestamptz, text, double precision, double precision, text
) TO service_role;
