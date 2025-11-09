/*
  Allow administrators to update user profile details (email, full name)
  and keep auth.users/public.users in sync.
*/
CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
  existing_user auth.users%ROWTYPE;
  normalized_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user_id';
  END IF;

  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT * INTO existing_user FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF p_email IS NOT NULL THEN
    normalized_email := trim(lower(p_email));
    IF length(normalized_email) = 0 THEN
      RAISE EXCEPTION 'invalid_email';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM auth.users
      WHERE email = normalized_email AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'email_in_use';
    END IF;

    UPDATE auth.users
    SET email = normalized_email
    WHERE id = p_user_id;

    UPDATE public.users
    SET email = normalized_email
    WHERE id = p_user_id;
  END IF;

  IF p_full_name IS NOT NULL THEN
    UPDATE public.users
    SET full_name = trim(p_full_name)
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION admin_update_user(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_user(uuid, text, text) TO authenticated;