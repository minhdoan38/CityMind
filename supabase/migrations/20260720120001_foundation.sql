-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    report_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    category TEXT,
    severity INTEGER,
    confidence DOUBLE PRECISION,
    summary TEXT,
    recommendation TEXT,
    priority TEXT,
    estimated_impact TEXT,
    evidence JSONB,
    uncertainty JSONB,
    urban_context JSONB,
    image_gcs_uri TEXT
);

-- Create status_events table
CREATE TABLE IF NOT EXISTS public.status_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create access_tokens table
CREATE TABLE IF NOT EXISTS public.access_tokens (
    token_hash TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS status_events_report_id_idx ON public.status_events(report_id);
CREATE INDEX IF NOT EXISTS status_events_created_at_idx ON public.status_events(created_at DESC);
CREATE INDEX IF NOT EXISTS access_tokens_report_id_idx ON public.access_tokens(report_id);

-- Enable RLS on all tables
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

-- Helper function to check if caller is an officer/admin
CREATE OR REPLACE FUNCTION public.is_officer_or_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    RETURN (auth.jwt()->'app_metadata'->>'role') IN ('officer', 'admin');
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for reports
CREATE POLICY select_reports_officer_admin ON public.reports
    FOR SELECT
    USING (public.is_officer_or_admin());

CREATE POLICY insert_reports_public ON public.reports
    FOR INSERT
    WITH CHECK (true); -- service-role or anon public ingest via FastAPI

CREATE POLICY update_reports_officer_admin ON public.reports
    FOR UPDATE
    USING (public.is_officer_or_admin());

-- RLS Policies for status_events
CREATE POLICY select_status_events_officer_admin ON public.status_events
    FOR SELECT
    USING (public.is_officer_or_admin());

CREATE POLICY insert_status_events_officer_admin ON public.status_events
    FOR INSERT
    WITH CHECK (public.is_officer_or_admin());

-- RLS Policies for access_tokens (service-role only, which bypasses RLS, so no policy needed for general users; default is deny)

-- Setup private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence', 'evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage objects (evidence bucket)
CREATE POLICY select_evidence_officer_admin ON storage.objects
    FOR SELECT
    USING (bucket_id = 'evidence' AND public.is_officer_or_admin());

CREATE POLICY insert_evidence_public ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'evidence'); -- allowed for public uploads / service-role
