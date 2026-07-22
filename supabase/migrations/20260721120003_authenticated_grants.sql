-- PostgREST uses the `authenticated` role for JWT-backed requests.
-- RLS policies alone are not enough without table-level grants.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, UPDATE ON public.reports TO authenticated;
GRANT SELECT, INSERT ON public.status_events TO authenticated;
