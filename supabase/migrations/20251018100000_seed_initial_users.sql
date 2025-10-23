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
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'kost@adminreal.cz', crypt('milan123', gen_salt('bf')), now())
  RETURNING id INTO u_milan;

  -- Zuzana (user)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'info@adminreal.cz', crypt('zuzana123', gen_salt('bf')), now())
  RETURNING id INTO u_zuzana;

  -- David (user)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'dvorak@adminreal.cz', crypt('david123', gen_salt('bf')), now())
  RETURNING id INTO u_david;

  -- Iveta (user)
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'faktury@adminreal.cz', crypt('iveta123', gen_salt('bf')), now())
  RETURNING id INTO u_iveta;

  -- Create public profiles
  INSERT INTO public.users (id, email, full_name, role, theme)
  VALUES
  (u_milan, 'kost@adminreal.cz', 'Milan', 'admin', 'light'),
  (u_zuzana, 'info@adminreal.cz', 'Zuzana', 'user', 'light'),
  (u_david, 'dvorak@adminreal.cz', 'David', 'user', 'light'),
  (u_iveta, 'faktury@adminreal.cz', 'Iveta', 'user', 'light');
END $$;
