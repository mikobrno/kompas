/*
  Secure role update function for admins
*/
CREATE OR REPLACE FUNCTION set_user_role(target_user uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins may call this
  IF (SELECT role FROM public.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF new_role NOT IN ('admin','user') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  -- Prevent removing role from the last admin
  IF new_role = 'user' THEN
    IF (SELECT count(*) FROM public.users WHERE role = 'admin') <= 1
       AND (SELECT role FROM public.users WHERE id = target_user) = 'admin' THEN
      RAISE EXCEPTION 'must_keep_at_least_one_admin';
    END IF;
  END IF;

  UPDATE public.users SET role = new_role WHERE id = target_user;
END;
$$;

REVOKE ALL ON FUNCTION set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_user_role(uuid, text) TO authenticated;
