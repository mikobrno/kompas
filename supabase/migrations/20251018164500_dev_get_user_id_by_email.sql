-- Dev-only helper RPC to fetch user id by email using SECURITY DEFINER (bypasses RLS)
-- Note: This exists to enable local dev login fallback when Auth service is misconfigured.
-- Do NOT expose sensitive data; it returns only the UUID id for an email present in public.users.

CREATE OR REPLACE FUNCTION dev_get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE email = p_email;
$$;

REVOKE ALL ON FUNCTION dev_get_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dev_get_user_id_by_email(text) TO anon, authenticated;
