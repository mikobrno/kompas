-- Allow recipients of category shares to read share rows so links RLS policies
-- that reference category_shares via EXISTS can evaluate to TRUE for recipients.
-- Without this, recipients see categories (via categories policy) but not links.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Recipients can read category shares'
  ) THEN
    CREATE POLICY "Recipients can read category shares"
    ON category_shares FOR SELECT
    TO authenticated
    USING (
      shared_with_user_id = auth.uid()
      OR shared_with_group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;
