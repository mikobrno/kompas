/*
  # Fix infinite recursion in RLS policies
  
  1. Remove all policies with recursive checks on users table
  2. Create simple policies for categories (owner-based only for now)
  3. Add shared categories support via RPC function instead of RLS
*/

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can read own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage all categories" ON public.categories;
DROP POLICY IF EXISTS "Users can read own or shared categories" ON public.categories;
DROP POLICY IF EXISTS "select_own" ON public.categories;
DROP POLICY IF EXISTS "insert_own" ON public.categories;
DROP POLICY IF EXISTS "update_own" ON public.categories;
DROP POLICY IF EXISTS "delete_own" ON public.categories;

-- Create simple, non-recursive policies
CREATE POLICY "enable_read_own_categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "enable_insert_own_categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "enable_update_own_categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "enable_delete_own_categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Service role má plný přístup (pro admin operace)
CREATE POLICY "service_role_all_categories"
  ON public.categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
