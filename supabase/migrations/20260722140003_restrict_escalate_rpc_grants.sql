-- Tighten escalate RPC grants for Supabase anon/authenticated roles.

REVOKE ALL ON FUNCTION public.escalate_report_to_government(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.escalate_report_to_government(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.escalate_report_to_government(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_report_to_government(text, text, text) TO service_role;
