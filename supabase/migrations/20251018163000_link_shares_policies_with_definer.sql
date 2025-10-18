-- Use SECURITY DEFINER helpers in link_shares policies to avoid RLS recursion with links
CREATE OR REPLACE FUNCTION can_manage_link_share(p_link_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM links l
    JOIN categories c ON c.id = l.category_id
    WHERE l.id = p_link_id
      AND c.owner_id = auth.uid()
  );
$$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Drop all existing policies on link_shares to start clean
  FOR pol IN SELECT polname FROM pg_catalog.pg_policy WHERE polrelid = 'public.link_shares'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.link_shares', pol.polname);
  END LOOP;

  -- Read access: recipients can see rows shared with them (no links reference)
  CREATE POLICY "Recipients can read link shares"
    ON public.link_shares FOR SELECT
    TO authenticated
    USING (
      shared_with_user_id = auth.uid()
      OR shared_with_group_id IN (
        SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
      )
    );

  -- Owners manage via SECURITY DEFINER helper (no direct links reference in policy)
  CREATE POLICY "Owners can insert link shares"
    ON public.link_shares FOR INSERT
    TO authenticated
    WITH CHECK (can_manage_link_share(link_shares.link_id));

  CREATE POLICY "Owners can update link shares"
    ON public.link_shares FOR UPDATE
    TO authenticated
    USING (can_manage_link_share(link_shares.link_id))
    WITH CHECK (can_manage_link_share(link_shares.link_id));

  CREATE POLICY "Owners can delete link shares"
    ON public.link_shares FOR DELETE
    TO authenticated
    USING (can_manage_link_share(link_shares.link_id));

  -- Admin manage all (non-recursive via is_admin())
  CREATE POLICY "Admins can manage link shares"
    ON public.link_shares FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
END $$;