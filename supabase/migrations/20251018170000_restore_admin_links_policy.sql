-- Ensure admins keep full access to manage links even after minimal policy reset
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage all links'
  ) THEN
    DROP POLICY "Admins can manage all links" ON public.links;
  END IF;

  CREATE POLICY "Admins can manage all links"
    ON public.links FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
END $$;
