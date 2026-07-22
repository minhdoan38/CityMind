-- Phase 7 Plan 08: additive evidence_path column (no drop of image_gcs_uri).

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS evidence_path TEXT;

UPDATE public.reports
SET evidence_path = regexp_replace(image_gcs_uri, '^supabase://', '')
WHERE image_gcs_uri LIKE 'supabase://%'
  AND evidence_path IS NULL;

ALTER TABLE public.reports
    DROP CONSTRAINT IF EXISTS reports_evidence_path_format_chk;

ALTER TABLE public.reports
    ADD CONSTRAINT reports_evidence_path_format_chk
    CHECK (evidence_path IS NULL OR evidence_path ~ '^[^/]+/.+');

CREATE INDEX IF NOT EXISTS reports_evidence_path_idx
    ON public.reports (evidence_path)
    WHERE evidence_path IS NOT NULL;

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
    p_image_gcs_uri text DEFAULT NULL,
    p_evidence_path text DEFAULT NULL
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
        evidence_path,
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
        p_evidence_path,
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
    text, integer, double precision, text, text, text, text, jsonb, jsonb, jsonb, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_report_with_access_token(
    text, text, timestamptz, text, double precision, double precision,
    text, integer, double precision, text, text, text, text, jsonb, jsonb, jsonb, text, text
) TO service_role;
