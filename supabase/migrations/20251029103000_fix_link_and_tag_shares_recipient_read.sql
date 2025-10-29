-- Allow recipients of link and tag shares to read corresponding share rows,
-- so RLS checks and UI can reliably infer share state for recipients.

DO $$
BEGIN
  -- link_shares recipients read (only if table exists)
  IF to_regclass('public.link_shares') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Recipients can read link shares'
    ) THEN
      CREATE POLICY "Recipients can read link shares"
      ON link_shares FOR SELECT
      TO authenticated
      USING (
        shared_with_user_id = auth.uid()
        OR shared_with_group_id IN (
          SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
      );
    END IF;
  END IF;

  -- tag_shares recipients read (only if table exists)
  IF to_regclass('public.tag_shares') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Recipients can read tag shares'
    ) THEN
      CREATE POLICY "Recipients can read tag shares"
      ON tag_shares FOR SELECT
      TO authenticated
      USING (
        shared_with_user_id = auth.uid()
        OR shared_with_group_id IN (
          SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
      );
    END IF;
  END IF;
END $$;
