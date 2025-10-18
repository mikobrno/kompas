-- Avoid circular RLS between links <-> link_shares by simplifying recipient read policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Users can see enforced link shares'
  ) THEN
    DROP POLICY "Users can see enforced link shares" ON link_shares;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Recipients can read link shares'
  ) THEN
    CREATE POLICY "Recipients can read link shares"
      ON link_shares FOR SELECT
      TO authenticated
      USING (
        shared_with_user_id = auth.uid()
        OR shared_with_group_id IN (
          SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
        )
      );
  END IF;
END $$;
