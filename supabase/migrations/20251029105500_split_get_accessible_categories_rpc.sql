-- Split get_accessible_categories_with_permission RPC into
-- 1) default zero-argument function for the current user
-- 2) admin-only function allowing override target user

DROP FUNCTION IF EXISTS get_accessible_categories_with_permission();
DROP FUNCTION IF EXISTS get_accessible_categories_with_permission(uuid);
DROP FUNCTION IF EXISTS admin_get_accessible_categories_with_permission(uuid);

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
DECLARE
  target_user uuid := auth.uid();
BEGIN
  IF target_user IS NULL THEN
    RAISE EXCEPTION 'No authenticated user' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH user_groups AS (
    SELECT group_id FROM group_members WHERE user_id = effective_user
  ),
  link_shared AS (
    SELECT
      c.id,
      c.name,
      c.owner_id,
      c.is_archived,
      c.display_order,
      c.created_at,
      c.color_hex,
      ARRAY_AGG(DISTINCT ls.link_id) FILTER (WHERE ls.link_id IS NOT NULL) AS shared_link_ids
    FROM categories c
    JOIN links l ON l.category_id = c.id
    JOIN link_shares ls ON ls.link_id = l.id
    WHERE (
  ls.shared_with_user_id = effective_user
  OR ls.shared_with_group_id IN (SELECT group_id FROM user_groups)
    )
      AND c.is_archived = false
      AND l.is_archived = false
    GROUP BY c.id, c.name, c.owner_id, c.is_archived, c.display_order, c.created_at, c.color_hex
  ),
  tag_shared AS (
    SELECT
      c.id,
      c.name,
      c.owner_id,
      c.is_archived,
      c.display_order,
      c.created_at,
      c.color_hex,
      ARRAY_AGG(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL) AS shared_link_ids
    FROM categories c
    JOIN links l ON l.category_id = c.id
    JOIN link_tags lt ON lt.link_id = l.id
    JOIN tag_shares ts ON ts.tag_id = lt.tag_id AND ts.owner_id = c.owner_id
    WHERE (
  ts.shared_with_user_id = effective_user
  OR ts.shared_with_group_id IN (SELECT group_id FROM user_groups)
    )
      AND c.is_archived = false
      AND l.is_archived = false
    GROUP BY c.id, c.name, c.owner_id, c.is_archived, c.display_order, c.created_at, c.color_hex
  ),
  combined AS (
    SELECT c.id,
           c.name,
           c.owner_id,
           c.is_archived,
           c.display_order,
           c.created_at,
           'owner'::text AS permission,
           NULL::uuid[] AS shared_link_ids,
           c.color_hex,
           1 AS priority
    FROM categories c
  WHERE c.owner_id = effective_user
      AND c.is_archived = false

    UNION ALL

    SELECT c.id,
           c.name,
           c.owner_id,
           c.is_archived,
           c.display_order,
           c.created_at,
           cs.permission_level AS permission,
           NULL::uuid[] AS shared_link_ids,
           c.color_hex,
           CASE WHEN cs.permission_level = 'editor' THEN 2 ELSE 3 END AS priority
    FROM categories c
    JOIN category_shares cs ON cs.category_id = c.id
    WHERE (
  cs.shared_with_user_id = effective_user
  OR cs.shared_with_group_id IN (SELECT group_id FROM user_groups)
    )
      AND c.is_archived = false

    UNION ALL

    SELECT ls.id,
           ls.name,
           ls.owner_id,
           ls.is_archived,
           ls.display_order,
           ls.created_at,
           'viewer'::text AS permission,
           COALESCE(ls.shared_link_ids, ARRAY[]::uuid[]),
           ls.color_hex,
           4 AS priority
    FROM link_shared ls

    UNION ALL

    SELECT ts.id,
           ts.name,
           ts.owner_id,
           ts.is_archived,
           ts.display_order,
           ts.created_at,
           'viewer'::text AS permission,
           COALESCE(ts.shared_link_ids, ARRAY[]::uuid[]),
           ts.color_hex,
           5 AS priority
    FROM tag_shared ts
  ),
  dedup AS (
    SELECT DISTINCT ON (combined.id)
      combined.id,
      combined.name,
      combined.owner_id,
      combined.is_archived,
      combined.display_order,
      combined.created_at,
      combined.permission,
      combined.shared_link_ids,
      combined.color_hex
    FROM combined
    ORDER BY combined.id, combined.priority
  )
  SELECT
    d.id,
    d.name,
    d.owner_id,
    d.is_archived,
    d.display_order,
    d.created_at,
    d.permission,
    CASE
      WHEN d.shared_link_ids IS NULL OR array_length(d.shared_link_ids, 1) = 0 THEN NULL
      ELSE d.shared_link_ids
    END AS shared_link_ids,
    d.color_hex
  FROM dedup d
  WHERE d.is_archived = false
  ORDER BY d.display_order ASC, d.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION admin_get_accessible_categories_with_permission(p_target_user uuid)
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
DECLARE
  acting_role text;
  effective_user uuid := p_target_user;
BEGIN
  IF effective_user IS NULL THEN
    RAISE EXCEPTION 'Target user must be provided' USING ERRCODE = '22004';
  END IF;

  SELECT role INTO acting_role FROM users WHERE users.id = auth.uid();
  IF acting_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins may override target user' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH user_groups AS (
    SELECT group_id FROM group_members WHERE user_id = target_user
  ),
  link_shared AS (
    SELECT
      c.id,
      c.name,
      c.owner_id,
      c.is_archived,
      c.display_order,
      c.created_at,
      c.color_hex,
      ARRAY_AGG(DISTINCT ls.link_id) FILTER (WHERE ls.link_id IS NOT NULL) AS shared_link_ids
    FROM categories c
    JOIN links l ON l.category_id = c.id
    JOIN link_shares ls ON ls.link_id = l.id
    WHERE (
      ls.shared_with_user_id = target_user
      OR ls.shared_with_group_id IN (SELECT group_id FROM user_groups)
    )
      AND c.is_archived = false
      AND l.is_archived = false
    GROUP BY c.id, c.name, c.owner_id, c.is_archived, c.display_order, c.created_at, c.color_hex
  ),
  tag_shared AS (
    SELECT
      c.id,
      c.name,
      c.owner_id,
      c.is_archived,
      c.display_order,
      c.created_at,
      c.color_hex,
      ARRAY_AGG(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL) AS shared_link_ids
    FROM categories c
    JOIN links l ON l.category_id = c.id
    JOIN link_tags lt ON lt.link_id = l.id
    JOIN tag_shares ts ON ts.tag_id = lt.tag_id AND ts.owner_id = c.owner_id
    WHERE (
      ts.shared_with_user_id = target_user
      OR ts.shared_with_group_id IN (SELECT group_id FROM user_groups)
    )
      AND c.is_archived = false
      AND l.is_archived = false
    GROUP BY c.id, c.name, c.owner_id, c.is_archived, c.display_order, c.created_at, c.color_hex
  ),
  combined AS (
    SELECT c.id,
           c.name,
           c.owner_id,
           c.is_archived,
           c.display_order,
           c.created_at,
           'owner'::text AS permission,
           NULL::uuid[] AS shared_link_ids,
           c.color_hex,
           1 AS priority
    FROM categories c
    WHERE c.owner_id = target_user
      AND c.is_archived = false

    UNION ALL

    SELECT c.id,
           c.name,
           c.owner_id,
           c.is_archived,
           c.display_order,
           c.created_at,
           cs.permission_level AS permission,
           NULL::uuid[] AS shared_link_ids,
           c.color_hex,
           CASE WHEN cs.permission_level = 'editor' THEN 2 ELSE 3 END AS priority
    FROM categories c
    JOIN category_shares cs ON cs.category_id = c.id
    WHERE (
      cs.shared_with_user_id = target_user
      OR cs.shared_with_group_id IN (SELECT group_id FROM user_groups)
    )
      AND c.is_archived = false

    UNION ALL

    SELECT ls.id,
           ls.name,
           ls.owner_id,
           ls.is_archived,
           ls.display_order,
           ls.created_at,
           'viewer'::text AS permission,
           COALESCE(ls.shared_link_ids, ARRAY[]::uuid[]),
           ls.color_hex,
           4 AS priority
    FROM link_shared ls

    UNION ALL

    SELECT ts.id,
           ts.name,
           ts.owner_id,
           ts.is_archived,
           ts.display_order,
           ts.created_at,
           'viewer'::text AS permission,
           COALESCE(ts.shared_link_ids, ARRAY[]::uuid[]),
           ts.color_hex,
           5 AS priority
    FROM tag_shared ts
  ),
  dedup AS (
    SELECT DISTINCT ON (combined.id)
      combined.id,
      combined.name,
      combined.owner_id,
      combined.is_archived,
      combined.display_order,
      combined.created_at,
      combined.permission,
      combined.shared_link_ids,
      combined.color_hex
    FROM combined
    ORDER BY combined.id, combined.priority
  )
  SELECT
    d.id,
    d.name,
    d.owner_id,
    d.is_archived,
    d.display_order,
    d.created_at,
    d.permission,
    CASE
      WHEN d.shared_link_ids IS NULL OR array_length(d.shared_link_ids, 1) = 0 THEN NULL
      ELSE d.shared_link_ids
    END AS shared_link_ids,
    d.color_hex
  FROM dedup d
  WHERE d.is_archived = false
  ORDER BY d.display_order ASC, d.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION get_accessible_categories_with_permission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_accessible_categories_with_permission() TO authenticated;

REVOKE ALL ON FUNCTION admin_get_accessible_categories_with_permission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_accessible_categories_with_permission(uuid) TO authenticated;
