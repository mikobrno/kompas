-- Restore zero-argument wrapper for get_accessible_categories_with_permission
-- so clients without override parameter keep working (PostgREST 404 otherwise)

CREATE OR REPLACE FUNCTION get_accessible_categories_with_permission()
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  is_archived boolean,
  display_order integer,
  created_at timestamptz,
  permission text,
  shared_link_ids uuid[],
  color_hex text
) AS $$
  SELECT *
  FROM get_accessible_categories_with_permission(NULL::uuid);
$$ LANGUAGE sql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION get_accessible_categories_with_permission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_accessible_categories_with_permission() TO anon;
GRANT EXECUTE ON FUNCTION get_accessible_categories_with_permission() TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_categories_with_permission() TO service_role;
