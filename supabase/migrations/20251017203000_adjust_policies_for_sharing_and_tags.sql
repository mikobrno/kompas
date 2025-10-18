/*
  # Adjust RLS for Sharing and Central Tag Management
  - Allow all authenticated users to read basic user profiles (for sharing dialog)
  - Allow admins to manage link_tags globally (for tag merge/maintenance)
*/

-- Users: allow authenticated to read all users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Authenticated can read all users' AND tablename = 'users' AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Authenticated can read all users"
      ON users FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- link_tags: allow admins to manage all
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can manage all link tags' AND tablename = 'link_tags' AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Admins can manage all link tags"
      ON link_tags FOR ALL
      TO authenticated
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
      WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;
