-- Ensure admin_create_user inserts auth.users rows with non-null columns expected by GoTrue.
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text DEFAULT 'user'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- Only admins may call
  IF (SELECT role FROM public.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_role NOT IN ('admin','user') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  -- Create auth user if not exists
  SELECT id INTO new_id FROM auth.users WHERE email = p_email;
  IF new_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
    RETURNING id INTO new_id;
  END IF;

  -- Create/ensure public profile
  INSERT INTO public.users (id, email, full_name, role, theme)
  VALUES (new_id, p_email, p_full_name, p_role, 'light')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_create_user(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, text) TO authenticated;
