-- Create tag_shares table to allow sharing links by tag scope (owner-scoped)
CREATE TABLE IF NOT EXISTS tag_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  shared_with_group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  permission_level text NOT NULL CHECK (permission_level IN ('viewer', 'editor')),
  created_at timestamptz DEFAULT now(),
  CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_group_id IS NULL) OR
    (shared_with_user_id IS NULL AND shared_with_group_id IS NOT NULL)
  )
);

ALTER TABLE tag_shares ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tag_shares_tag ON tag_shares(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_shares_owner ON tag_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_tag_shares_user ON tag_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_tag_shares_group ON tag_shares(shared_with_group_id);

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Owners can manage tag shares'
  ) THEN
    CREATE POLICY "Owners can manage tag shares"
      ON tag_shares FOR ALL
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage tag shares'
  ) THEN
    CREATE POLICY "Admins can manage tag shares"
      ON tag_shares FOR ALL
      TO authenticated
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
      WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Users can see enforced tag shares'
  ) THEN
    -- Allow recipients to see rows that grant them access (for UI and RPC)
    CREATE POLICY "Users can see enforced tag shares"
      ON tag_shares FOR SELECT
      TO authenticated
      USING (
        shared_with_user_id = auth.uid()
        OR shared_with_group_id IN (
          SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
        )
        OR owner_id = auth.uid()
      );
  END IF;
END $$;
