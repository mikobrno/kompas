
\restrict YaEYE1SLzKqelKN6pfDQVVTb4QQG6emDaWMFRAf49CRf4YTBsbArRvR9kFWtnbC


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_create_user"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text" DEFAULT 'user'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_id uuid;
BEGIN
  -- Only admins may call
  IF (SELECT role FROM public.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_role NOT IN ('admin','user') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  -- Create auth user if not exists
  SELECT id INTO new_id FROM auth.users WHERE email = p_email;
  IF new_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
    RETURNING id INTO new_id;
  END IF;

  -- Create/ensure public profile
  INSERT INTO public.users (id, email, full_name, role, theme)
  VALUES (new_id, p_email, p_full_name, p_role, 'light')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."admin_create_user"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_link_share"("p_link_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM links l
    JOIN categories c ON c.id = l.category_id
    WHERE l.id = p_link_id
      AND c.owner_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."can_manage_link_share"("p_link_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dev_get_user_id_by_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM public.users WHERE email = p_email;
$$;


ALTER FUNCTION "public"."dev_get_user_id_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_accessible_categories_with_permission"("override_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "owner_id" "uuid", "is_archived" boolean, "display_order" integer, "created_at" timestamp with time zone, "permission" "text", "shared_link_ids" "uuid"[], "color_hex" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_user uuid := auth.uid();
  acting_role text;
BEGIN
  IF override_user_id IS NOT NULL THEN
    SELECT role INTO acting_role FROM users WHERE users.id = auth.uid();
    IF acting_role = 'admin' THEN
      target_user := override_user_id;
    ELSE
      RAISE EXCEPTION 'Only admins may override target user' USING ERRCODE = '42501';
    END IF;
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
$$;


ALTER FUNCTION "public"."get_accessible_categories_with_permission"("override_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role = 'admin' FROM users WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_safe_search_path"() RETURNS "void"
    LANGUAGE "sql"
    AS $$
  SELECT set_config('search_path', 'public, extensions', false);
$$;


ALTER FUNCTION "public"."set_safe_search_path"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_role"("target_user" "uuid", "new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only admins may call this
  IF (SELECT role FROM public.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF new_role NOT IN ('admin','user') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  -- Prevent removing role from the last admin
  IF new_role = 'user' THEN
    IF (SELECT count(*) FROM public.users WHERE role = 'admin') <= 1
       AND (SELECT role FROM public.users WHERE id = target_user) = 'admin' THEN
      RAISE EXCEPTION 'must_keep_at_least_one_admin';
    END IF;
  END IF;

  UPDATE public.users SET role = new_role WHERE id = target_user;
END;
$$;


ALTER FUNCTION "public"."set_user_role"("target_user" "uuid", "new_role" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "is_archived" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "color_hex" "text" DEFAULT '#f05a28'::"text" NOT NULL,
    CONSTRAINT "categories_color_hex_format" CHECK (("color_hex" ~* '^#[0-9A-F]{6}$'::"text"))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "shared_with_user_id" "uuid",
    "shared_with_group_id" "uuid",
    "permission_level" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "category_shares_check" CHECK (((("shared_with_user_id" IS NOT NULL) AND ("shared_with_group_id" IS NULL)) OR (("shared_with_user_id" IS NULL) AND ("shared_with_group_id" IS NOT NULL)))),
    CONSTRAINT "category_shares_permission_level_check" CHECK (("permission_level" = ANY (ARRAY['viewer'::"text", 'editor'::"text"])))
);


ALTER TABLE "public"."category_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."link_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "shared_with_user_id" "uuid",
    "shared_with_group_id" "uuid",
    "permission_level" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "link_shares_check" CHECK (((("shared_with_user_id" IS NOT NULL) AND ("shared_with_group_id" IS NULL)) OR (("shared_with_user_id" IS NULL) AND ("shared_with_group_id" IS NOT NULL)))),
    CONSTRAINT "link_shares_permission_level_check" CHECK (("permission_level" = ANY (ARRAY['viewer'::"text", 'editor'::"text"])))
);


ALTER TABLE "public"."link_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."link_tags" (
    "link_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."link_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "favicon_url" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pinned_links" (
    "user_id" "uuid" NOT NULL,
    "link_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 0
);


ALTER TABLE "public"."pinned_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "theme" "text" DEFAULT 'light'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"]))),
    CONSTRAINT "users_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_shares"
    ADD CONSTRAINT "category_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."link_shares"
    ADD CONSTRAINT "link_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."link_tags"
    ADD CONSTRAINT "link_tags_pkey" PRIMARY KEY ("link_id", "tag_id");



ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pinned_links"
    ADD CONSTRAINT "pinned_links_pkey" PRIMARY KEY ("user_id", "link_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_categories_archived" ON "public"."categories" USING "btree" ("is_archived");



CREATE INDEX "idx_categories_owner" ON "public"."categories" USING "btree" ("owner_id");



CREATE INDEX "idx_category_shares_category" ON "public"."category_shares" USING "btree" ("category_id");



CREATE INDEX "idx_category_shares_group" ON "public"."category_shares" USING "btree" ("shared_with_group_id");



CREATE INDEX "idx_category_shares_user" ON "public"."category_shares" USING "btree" ("shared_with_user_id");



CREATE INDEX "idx_group_members_user" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_link_shares_group" ON "public"."link_shares" USING "btree" ("shared_with_group_id");



CREATE INDEX "idx_link_shares_link" ON "public"."link_shares" USING "btree" ("link_id");



CREATE INDEX "idx_link_shares_user" ON "public"."link_shares" USING "btree" ("shared_with_user_id");



CREATE INDEX "idx_links_archived" ON "public"."links" USING "btree" ("is_archived");



CREATE INDEX "idx_links_category" ON "public"."links" USING "btree" ("category_id");



CREATE INDEX "idx_pinned_links_user" ON "public"."pinned_links" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_shares"
    ADD CONSTRAINT "category_shares_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_shares"
    ADD CONSTRAINT "category_shares_shared_with_group_id_fkey" FOREIGN KEY ("shared_with_group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_shares"
    ADD CONSTRAINT "category_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."link_shares"
    ADD CONSTRAINT "link_shares_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."link_shares"
    ADD CONSTRAINT "link_shares_shared_with_group_id_fkey" FOREIGN KEY ("shared_with_group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."link_shares"
    ADD CONSTRAINT "link_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."link_tags"
    ADD CONSTRAINT "link_tags_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."link_tags"
    ADD CONSTRAINT "link_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pinned_links"
    ADD CONSTRAINT "pinned_links_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pinned_links"
    ADD CONSTRAINT "pinned_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can insert users" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage all categories" ON "public"."categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage all link tags" ON "public"."link_tags" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage all tags" ON "public"."tags" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage group memberships" ON "public"."group_members" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage groups" ON "public"."groups" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage link shares" ON "public"."link_shares" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can read all users" ON "public"."users" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can update users" ON "public"."users" FOR UPDATE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Authenticated can read all users" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create tags" ON "public"."tags" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read groups" ON "public"."groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read tags" ON "public"."tags" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Owners can delete link shares" ON "public"."link_shares" FOR DELETE TO "authenticated" USING ("public"."can_manage_link_share"("link_id"));



CREATE POLICY "Owners can insert link shares" ON "public"."link_shares" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_link_share"("link_id"));



CREATE POLICY "Owners can update link shares" ON "public"."link_shares" FOR UPDATE TO "authenticated" USING ("public"."can_manage_link_share"("link_id")) WITH CHECK ("public"."can_manage_link_share"("link_id"));



CREATE POLICY "Recipients can read category shares" ON "public"."category_shares" FOR SELECT TO "authenticated" USING ((("shared_with_user_id" = "auth"."uid"()) OR ("shared_with_group_id" IN ( SELECT "group_members"."group_id"
   FROM "public"."group_members"
  WHERE ("group_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Recipients can read link shares" ON "public"."link_shares" FOR SELECT TO "authenticated" USING ((("shared_with_user_id" = "auth"."uid"()) OR ("shared_with_group_id" IN ( SELECT "gm"."group_id"
   FROM "public"."group_members" "gm"
  WHERE ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Service role can do anything" ON "public"."users" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create shares for their categories" ON "public"."category_shares" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_shares"."category_id") AND ("c"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete shares for their categories" ON "public"."category_shares" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_shares"."category_id") AND ("c"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own pinned links" ON "public"."pinned_links" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage tags on editable links" ON "public"."link_tags" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."links" "l"
     JOIN "public"."categories" "c" ON (("c"."id" = "l"."category_id")))
  WHERE (("l"."id" = "link_tags"."link_id") AND (("c"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."category_shares" "cs"
          WHERE (("cs"."category_id" = "c"."id") AND ("cs"."permission_level" = 'editor'::"text") AND (("cs"."shared_with_user_id" = "auth"."uid"()) OR ("cs"."shared_with_group_id" IN ( SELECT "group_members"."group_id"
                   FROM "public"."group_members"
                  WHERE ("group_members"."user_id" = "auth"."uid"()))))))))))));



CREATE POLICY "Users can read link tags for accessible links" ON "public"."link_tags" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."links" "l"
     JOIN "public"."categories" "c" ON (("c"."id" = "l"."category_id")))
  WHERE (("l"."id" = "link_tags"."link_id") AND (("c"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."category_shares" "cs"
          WHERE (("cs"."category_id" = "c"."id") AND (("cs"."shared_with_user_id" = "auth"."uid"()) OR ("cs"."shared_with_group_id" IN ( SELECT "group_members"."group_id"
                   FROM "public"."group_members"
                  WHERE ("group_members"."user_id" = "auth"."uid"()))))))))))));



CREATE POLICY "Users can read own pinned links" ON "public"."pinned_links" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own profile" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read shares for their categories" ON "public"."category_shares" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_shares"."category_id") AND ("c"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can read their group memberships" ON "public"."group_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'admin'::"text")));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update shares for their categories" ON "public"."category_shares" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_shares"."category_id") AND ("c"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_shares"."category_id") AND ("c"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enable_delete_own_categories" ON "public"."categories" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "enable_insert_own_categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "enable_read_own_categories" ON "public"."categories" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "enable_update_own_categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."link_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."link_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "links_cud_owner_only" ON "public"."links" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "links"."category_id") AND ("c"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "links"."category_id") AND ("c"."owner_id" = "auth"."uid"())))));



CREATE POLICY "links_read_owner_or_shared" ON "public"."links" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "links"."category_id") AND ("c"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."link_shares" "ls"
  WHERE (("ls"."link_id" = "links"."id") AND (("ls"."shared_with_user_id" = "auth"."uid"()) OR ("ls"."shared_with_group_id" IN ( SELECT "gm"."group_id"
           FROM "public"."group_members" "gm"
          WHERE ("gm"."user_id" = "auth"."uid"())))))))));



ALTER TABLE "public"."pinned_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_all_categories" ON "public"."categories" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_create_user"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_user"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_user"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_user"("p_email" "text", "p_password" "text", "p_full_name" "text", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_link_share"("p_link_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_link_share"("p_link_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_link_share"("p_link_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dev_get_user_id_by_email"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dev_get_user_id_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dev_get_user_id_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dev_get_user_id_by_email"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_accessible_categories_with_permission"("override_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_accessible_categories_with_permission"("override_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_accessible_categories_with_permission"("override_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accessible_categories_with_permission"("override_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_safe_search_path"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_safe_search_path"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_safe_search_path"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_role"("target_user" "uuid", "new_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_role"("target_user" "uuid", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_role"("target_user" "uuid", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_role"("target_user" "uuid", "new_role" "text") TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_shares" TO "anon";
GRANT ALL ON TABLE "public"."category_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."category_shares" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."link_shares" TO "anon";
GRANT ALL ON TABLE "public"."link_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."link_shares" TO "service_role";



GRANT ALL ON TABLE "public"."link_tags" TO "anon";
GRANT ALL ON TABLE "public"."link_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."link_tags" TO "service_role";



GRANT ALL ON TABLE "public"."links" TO "anon";
GRANT ALL ON TABLE "public"."links" TO "authenticated";
GRANT ALL ON TABLE "public"."links" TO "service_role";



GRANT ALL ON TABLE "public"."pinned_links" TO "anon";
GRANT ALL ON TABLE "public"."pinned_links" TO "authenticated";
GRANT ALL ON TABLE "public"."pinned_links" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






\unrestrict YaEYE1SLzKqelKN6pfDQVVTb4QQG6emDaWMFRAf49CRf4YTBsbArRvR9kFWtnbC

RESET ALL;
