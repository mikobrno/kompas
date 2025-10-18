-- Allow users to SELECT links that are shared with them (via category_shares or link_shares)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Users can read own links'
  ) THEN
    CREATE POLICY "Users can read own links"
      ON links FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM categories c
          WHERE c.id = links.category_id
          AND c.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Users can read links by category share'
  ) THEN
    CREATE POLICY "Users can read links by category share"
      ON links FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM category_shares cs
          WHERE cs.category_id = links.category_id
          AND (
            cs.shared_with_user_id = auth.uid()
            OR cs.shared_with_group_id IN (
              SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
            )
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Users can read links by link share'
  ) THEN
    CREATE POLICY "Users can read links by link share"
      ON links FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM link_shares ls
          WHERE ls.link_id = links.id
          AND (
            ls.shared_with_user_id = auth.uid()
            OR ls.shared_with_group_id IN (
              SELECT gm2.group_id FROM group_members gm2 WHERE gm2.user_id = auth.uid()
            )
          )
        )
      );
  END IF;
END $$;
