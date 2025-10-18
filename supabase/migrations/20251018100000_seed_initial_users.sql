/*
  Seed initial users and roles
  Creates auth users and corresponding public.users profiles.
  IMPORTANT: This script assumes execution with service role or as postgres.
*/

-- Create auth users
DO $$
DECLARE
  u_milan uuid;
  u_zuzana uuid;
  u_david uuid;
  u_iveta uuid;
BEGIN
  -- Milan (admin)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'milan@example.com', crypt('milan123', gen_salt('bf')), now())
  RETURNING id INTO u_milan;

  -- Zuzana (user)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'zuzana@example.com', crypt('zuzana123', gen_salt('bf')), now())
  RETURNING id INTO u_zuzana;

  -- David (user)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'david@example.com', crypt('david123', gen_salt('bf')), now())
  RETURNING id INTO u_david;

  -- Iveta (user)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'iveta@example.com', crypt('iveta123', gen_salt('bf')), now())
  RETURNING id INTO u_iveta;

  -- Create public profiles
  INSERT INTO public.users (id, email, full_name, role, theme)
  VALUES
    (u_milan, 'milan@example.com', 'Milan', 'admin', 'light'),
    (u_zuzana, 'zuzana@example.com', 'Zuzana', 'user', 'light'),
    (u_david, 'david@example.com', 'David', 'user', 'light'),
    (u_iveta, 'iveta@example.com', 'Iveta', 'user', 'light');
END $$;
