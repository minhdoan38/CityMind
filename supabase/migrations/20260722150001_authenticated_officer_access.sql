-- Laptop/dev mode: any authenticated Supabase user may use officer surfaces.
CREATE OR REPLACE FUNCTION public.is_officer_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN auth.uid() IS NOT NULL;
END;
$$;
