-- Properly reset all links policies and apply minimal non-recursive set
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT polname FROM pg_catalog.pg_policy WHERE polrelid = 'public.links'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.links', pol.polname);
  END LOOP;

  -- Minimal READ: owner or link_share recipient
  CREATE POLICY "links_read_owner_or_shared"
    ON public.links FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM categories c WHERE c.id = links.category_id AND c.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM link_shares ls
        WHERE ls.link_id = links.id
          AND (
            ls.shared_with_user_id = auth.uid()
            OR ls.shared_with_group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid())
          )
      )
    );

  -- Minimal CUD: only owners
  CREATE POLICY "links_cud_owner_only"
    ON public.links FOR ALL
    TO authenticated
    USING (
      EXISTS (SELECT 1 FROM categories c WHERE c.id = links.category_id AND c.owner_id = auth.uid())
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM categories c WHERE c.id = links.category_id AND c.owner_id = auth.uid())
    );
END $$;
