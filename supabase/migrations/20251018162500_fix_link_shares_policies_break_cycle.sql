-- Break recursive RLS between links <-> link_shares by removing SELECT policies on link_shares that reference links
DO $$
BEGIN
  -- Drop owner/admin SELECT-capable policies on link_shares
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Owners can read link shares'
  ) THEN
    DROP POLICY "Owners can read link shares" ON link_shares;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Owners can manage link shares'
  ) THEN
    DROP POLICY "Owners can manage link shares" ON link_shares;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage link shares'
  ) THEN
    DROP POLICY "Admins can manage link shares" ON link_shares;
  END IF;

  -- Keep recipients read-only policy intact (created in 20251018160000)

  -- Recreate owner policies without SELECT involvement
  CREATE POLICY "Owners can insert link shares"
    ON link_shares FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM links l
        JOIN categories c ON c.id = l.category_id
        WHERE l.id = link_shares.link_id
          AND c.owner_id = auth.uid()
      )
    );

  CREATE POLICY "Owners can update link shares"
    ON link_shares FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM links l
        JOIN categories c ON c.id = l.category_id
        WHERE l.id = link_shares.link_id
          AND c.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM links l
        JOIN categories c ON c.id = l.category_id
        WHERE l.id = link_shares.link_id
          AND c.owner_id = auth.uid()
      )
    );

  CREATE POLICY "Owners can delete link shares"
    ON link_shares FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM links l
        JOIN categories c ON c.id = l.category_id
        WHERE l.id = link_shares.link_id
          AND c.owner_id = auth.uid()
      )
    );

  -- Recreate admin manage policies without SELECT to avoid recursion in links->link_shares path
  CREATE POLICY "Admins can insert link shares"
    ON link_shares FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    );

  CREATE POLICY "Admins can update link shares"
    ON link_shares FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    );

  CREATE POLICY "Admins can delete link shares"
    ON link_shares FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    );
END $$;