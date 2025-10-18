/*
  # Fix RPC security for get_accessible_categories_with_permission
  - Switch to SECURITY INVOKER so that RLS policies evaluate under caller (authenticated user) instead of the function owner.
*/

CREATE OR REPLACE FUNCTION get_accessible_categories_with_permission()
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  is_archived boolean,
  display_order integer,
  created_at timestamptz,
  permission text
) AS $$
BEGIN
  RETURN QUERY
  WITH user_groups AS (
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  ),
  own AS (
    SELECT c.*, 'editor'::text AS permission
    FROM categories c
    WHERE c.owner_id = auth.uid()
  ),
  shared AS (
    SELECT c.*, cs.permission_level AS permission
    FROM categories c
    JOIN category_shares cs ON cs.category_id = c.id
    WHERE cs.shared_with_user_id = auth.uid()
       OR cs.shared_with_group_id IN (SELECT group_id FROM user_groups)
  )
  SELECT id, name, owner_id, is_archived, display_order, created_at, permission FROM own WHERE NOT is_archived
  UNION
  SELECT id, name, owner_id, is_archived, display_order, created_at, permission FROM shared WHERE NOT is_archived
  ORDER BY display_order ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

REVOKE ALL ON FUNCTION get_accessible_categories_with_permission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_accessible_categories_with_permission() TO authenticated;
