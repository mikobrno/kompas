/*
  # Function: get_accessible_categories_with_permission
  Returns categories visible to current user (own + shared) with computed permission ('editor' for own, otherwise per share).
*/

-- Ensure stable search_path for security definer functions
CREATE OR REPLACE FUNCTION set_safe_search_path() RETURNS void AS $$
  SELECT set_config('search_path', 'public, extensions', false);
$$ LANGUAGE sql;

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
  PERFORM set_safe_search_path();

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION get_accessible_categories_with_permission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_accessible_categories_with_permission() TO authenticated;
