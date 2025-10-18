-- Ensure auth.identities exist for seeded auth.users so password sign-in works
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, email FROM auth.users LOOP
    IF NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = r.id AND provider = 'email'
    ) THEN
      -- Insert identity for email provider; provider_id should be the email for email provider
      INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data)
      VALUES (
        gen_random_uuid(),
        r.id,
        'email',
        r.email,
        jsonb_build_object('sub', r.id::text, 'email', r.email)
      );
    END IF;
  END LOOP;
END $$;