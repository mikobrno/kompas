-- Create link_shares table for per-link sharing
CREATE TABLE IF NOT EXISTS link_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES links(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  shared_with_group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  permission_level text NOT NULL CHECK (permission_level IN ('viewer', 'editor')),
  created_at timestamptz DEFAULT now(),
  CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_group_id IS NULL) OR
    (shared_with_user_id IS NULL AND shared_with_group_id IS NOT NULL)
  )
);

ALTER TABLE link_shares ENABLE ROW LEVEL SECURITY;

-- Delete any existing category shares so nothing remains shared
DELETE FROM category_shares;

-- Policies: owners manage link shares
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Owners can read link shares'
  ) THEN
    CREATE POLICY "Owners can read link shares"
      ON link_shares FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM links l
          JOIN categories c ON c.id = l.category_id
          WHERE l.id = link_shares.link_id
          AND c.owner_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Owners can manage link shares'
  ) THEN
    CREATE POLICY "Owners can manage link shares"
      ON link_shares FOR ALL
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
  END IF;
END $$;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_link_shares_link ON link_shares(link_id);
CREATE INDEX IF NOT EXISTS idx_link_shares_user ON link_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_link_shares_group ON link_shares(shared_with_group_id);
