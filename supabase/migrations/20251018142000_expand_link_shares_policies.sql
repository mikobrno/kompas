-- Expand access policies for link_shares so that enforced shares are visible in UI
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage link shares'
  ) THEN
    CREATE POLICY "Admins can manage link shares"
      ON link_shares FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Users can see enforced link shares'
  ) THEN
    CREATE POLICY "Users can see enforced link shares"
      ON link_shares FOR SELECT
      TO authenticated
      USING (
        shared_with_user_id = auth.uid()
        OR shared_with_group_id IN (
          SELECT gm.group_id
          FROM group_members gm
          WHERE gm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM links l
          JOIN categories c ON c.id = l.category_id
          WHERE l.id = link_shares.link_id
          AND c.owner_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM links l
          JOIN categories c ON c.id = l.category_id
          JOIN category_shares cs ON cs.category_id = c.id
          WHERE l.id = link_shares.link_id
          AND cs.permission_level = 'editor'
          AND (
            cs.shared_with_user_id = auth.uid()
            OR cs.shared_with_group_id IN (
              SELECT gm2.group_id
              FROM group_members gm2
              WHERE gm2.user_id = auth.uid()
            )
          )
        )
      );
  END IF;
END $$;
