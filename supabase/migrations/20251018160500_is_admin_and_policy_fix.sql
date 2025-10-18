-- Helper function to avoid recursive role checks in policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'admin' FROM users WHERE id = auth.uid();
$$;

-- Update links admin policy to use is_admin()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage all links'
  ) THEN
    DROP POLICY "Admins can manage all links" ON links;
  END IF;
  CREATE POLICY "Admins can manage all links"
    ON links FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
END $$;

-- Update categories admin policy to use is_admin()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage all categories'
  ) THEN
    DROP POLICY "Admins can manage all categories" ON categories;
  END IF;
  CREATE POLICY "Admins can manage all categories"
    ON categories FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
END $$;

-- Update other places where inline role checks might cause recursion
DO $$
BEGIN
  -- users table admin policies
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can read all users') THEN
    DROP POLICY "Admins can read all users" ON users;
  END IF;
  CREATE POLICY "Admins can read all users"
    ON users FOR SELECT
    TO authenticated
    USING (is_admin());

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can insert users') THEN
    DROP POLICY "Admins can insert users" ON users;
  END IF;
  CREATE POLICY "Admins can insert users"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can update users') THEN
    DROP POLICY "Admins can update users" ON users;
  END IF;
  CREATE POLICY "Admins can update users"
    ON users FOR UPDATE
    TO authenticated
    USING (is_admin());

  -- link_tags admin manage all
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage all link tags') THEN
    DROP POLICY "Admins can manage all link tags" ON link_tags;
  END IF;
  CREATE POLICY "Admins can manage all link tags"
    ON link_tags FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

  -- groups admin manage
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage groups') THEN
    DROP POLICY "Admins can manage groups" ON groups;
  END IF;
  CREATE POLICY "Admins can manage groups"
    ON groups FOR ALL
    TO authenticated
    USING (is_admin());

  -- group_members admin manage
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage group memberships') THEN
    DROP POLICY "Admins can manage group memberships" ON group_members;
  END IF;
  CREATE POLICY "Admins can manage group memberships"
    ON group_members FOR ALL
    TO authenticated
    USING (is_admin());

  -- tags admin manage
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'Admins can manage all tags') THEN
    DROP POLICY "Admins can manage all tags" ON tags;
  END IF;
  CREATE POLICY "Admins can manage all tags"
    ON tags FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
END $$;
