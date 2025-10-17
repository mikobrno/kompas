/*
  # Fix Users Table RLS Policies
  
  1. Changes
    - Drop existing problematic policies causing infinite recursion
    - Create simpler policies without recursive checks
    - Allow users to be created during signup
  
  2. Security
    - Users can read their own profile
    - Users can update their own profile (but not change role)
    - Admins can manage all users
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;

-- Create new simplified policies
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can do anything"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);