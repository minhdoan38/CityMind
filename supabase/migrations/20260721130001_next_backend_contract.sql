-- Phase 7 Plan 04: atomic citizen report + hashed access token RPC and private evidence invariants.

-- Tighten access_tokens to service-role only (no anon/authenticated table grants).
REVOKE ALL ON TABLE public.access_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.access_tokens FROM anon;
REVOKE ALL ON TABLE public.access_tokens FROM authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.access_tokens TO service_role;

-- Ensure evidence bucket stays private with size/MIME limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence', 'evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Remove broad anonymous insert; trusted server uploads use service_role (bypasses RLS).
DROP POLICY IF EXISTS insert_evidence_public ON storage.objects;

-- Atomic report + hashed-token creation (plaintext token never stored or accepted).
CREATE OR REPLACE FUNCTION public.create_report_with_access_token(
    p_report_id text,
    p_token_hash text,
    p_token_expires_at timestamptz,
    p_description text DEFAULT NULL,
    p_latitude double precision DEFAULT NULL,
    p_longitude double precision DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_severity integer DEFAULT NULL,
    p_confidence double precision DEFAULT NULL,
    p_summary text DEFAULT NULL,
    p_recommendation text DEFAULT NULL,
    p_priority text DEFAULT NULL,
    p_estimated_impact text DEFAULT NULL,
    p_evidence jsonb DEFAULT '[]'::jsonb,
    p_uncertainty jsonb DEFAULT '[]'::jsonb,
    p_urban_context jsonb DEFAULT NULL,
    p_image_gcs_uri text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
        image_gcs_uri,
        current_status
    ) VALUES (
        p_report_id,
        p_description,
        p_latitude,
        p_longitude,
        p_category,
        p_severity,
        p_confidence,
        p_summary,
        p_recommendation,
        p_priority,
        p_estimated_impact,
        COALESCE(p_evidence, '[]'::jsonb),
        COALESCE(p_uncertainty, '[]'::jsonb),
        p_urban_context,
        p_image_gcs_uri,
        'new'
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

    RETURN jsonb_build_object('report_id', p_report_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_report_with_access_token(
    text, text, timestamptz, text, double precision, double precision,
    text, integer, double precision, text, text, text, text, jsonb, jsonb, jsonb, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_report_with_access_token(
    text, text, timestamptz, text, double precision, double precision,
    text, integer, double precision, text, text, text, text, jsonb, jsonb, jsonb, text
) TO service_role;
