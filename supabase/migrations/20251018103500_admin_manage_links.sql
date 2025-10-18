-- Allow admins to manage all links (update/delete/insert/select)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage all links'
  ) THEN
    CREATE POLICY "Admins can manage all links"
      ON links FOR ALL
      TO authenticated
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
      WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

