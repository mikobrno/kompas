/*
  # Kompas - Complete Database Schema
  
  1. New Tables
    - `users`
      - `id` (uuid, primary key) - Unique user identifier
      - `email` (text, unique) - User email address
      - `full_name` (text) - User's full name
      - `role` (text) - User role: 'admin' or 'user'
      - `theme` (text) - UI theme preference: 'light' or 'dark'
      - `created_at` (timestamptz) - Account creation timestamp
    
    - `groups`
      - `id` (uuid, primary key) - Unique group identifier
      - `name` (text) - Group name (e.g., "Marketing", "Developers")
      - `created_at` (timestamptz) - Group creation timestamp
    
    - `group_members`
      - `group_id` (uuid) - Reference to groups table
      - `user_id` (uuid) - Reference to users table
      - Primary key: (group_id, user_id)
    
    - `categories`
      - `id` (uuid, primary key) - Unique category identifier
      - `name` (text) - Category name
      - `owner_id` (uuid) - Reference to users table
      - `is_archived` (boolean) - Archive status
      - `display_order` (integer) - Order for display
      - `created_at` (timestamptz) - Creation timestamp
    
    - `links`
      - `id` (uuid, primary key) - Unique link identifier
      - `category_id` (uuid) - Reference to categories table
      - `display_name` (text) - Display name for the link
      - `url` (text) - Target URL
      - `favicon_url` (text, nullable) - URL to favicon image
      - `display_order` (integer) - Order within category
      - `created_at` (timestamptz) - Creation timestamp
    
    - `tags`
      - `id` (uuid, primary key) - Unique tag identifier
      - `name` (text, unique) - Tag name (e.g., "#projectX")
      - `created_at` (timestamptz) - Creation timestamp
    
    - `link_tags`
      - `link_id` (uuid) - Reference to links table
      - `tag_id` (uuid) - Reference to tags table
      - Primary key: (link_id, tag_id)
    
    - `category_shares`
      - `id` (uuid, primary key) - Unique share identifier
      - `category_id` (uuid) - Reference to categories table
      - `shared_with_user_id` (uuid, nullable) - Individual user share
      - `shared_with_group_id` (uuid, nullable) - Group share
      - `permission_level` (text) - 'viewer' or 'editor'
      - `created_at` (timestamptz) - Share creation timestamp
    
    - `pinned_links`
      - `user_id` (uuid) - Reference to users table
      - `link_id` (uuid) - Reference to links table
      - `display_order` (integer) - Order in pinned bar
      - Primary key: (user_id, link_id)
  
  2. Security
    - Enable RLS on all tables
    - Users can read their own profile
    - Users can update their own profile (theme, full_name)
    - Users can manage their own categories
    - Users can access shared categories based on permissions
    - Users can manage links in their own categories or categories shared with editor permission
    - Admins have full access to user and group management
    - Users can manage their own pinned links
    - Tag management based on ownership and sharing permissions
  
  3. Important Notes
    - All timestamps use timestamptz for proper timezone handling
    - Display order fields use integers for flexible reordering
    - Archive functionality preserves data instead of deleting
    - Sharing supports both individual users and groups
    - RLS policies ensure data security and proper access control
*/

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  created_at timestamptz DEFAULT now()
);

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  is_archived boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create links table
CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  display_name text NOT NULL,
  url text NOT NULL,
  favicon_url text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create link_tags table
CREATE TABLE IF NOT EXISTS link_tags (
  link_id uuid REFERENCES links(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, tag_id)
);

-- Create category_shares table
CREATE TABLE IF NOT EXISTS category_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  shared_with_group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  permission_level text NOT NULL CHECK (permission_level IN ('viewer', 'editor')),
  created_at timestamptz DEFAULT now(),
  CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_group_id IS NULL) OR
    (shared_with_user_id IS NULL AND shared_with_group_id IS NOT NULL)
  )
);

-- Create pinned_links table
CREATE TABLE IF NOT EXISTS pinned_links (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  link_id uuid REFERENCES links(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  PRIMARY KEY (user_id, link_id)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_links ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Groups policies
CREATE POLICY "Authenticated users can read groups"
  ON groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage groups"
  ON groups FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Group members policies
CREATE POLICY "Users can read their group memberships"
  ON group_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage group memberships"
  ON group_members FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Categories policies
CREATE POLICY "Users can read own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM category_shares cs
      WHERE cs.category_id = categories.id
      AND (
        cs.shared_with_user_id = auth.uid() OR
        cs.shared_with_group_id IN (
          SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can manage all categories"
  ON categories FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Links policies
CREATE POLICY "Users can read links from accessible categories"
  ON links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = links.category_id
      AND (
        c.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM category_shares cs
          WHERE cs.category_id = c.id
          AND (
            cs.shared_with_user_id = auth.uid() OR
            cs.shared_with_group_id IN (
              SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
          )
        )
      )
    )
  );

CREATE POLICY "Users can insert links in own or editable categories"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = links.category_id
      AND (
        c.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM category_shares cs
          WHERE cs.category_id = c.id
          AND cs.permission_level = 'editor'
          AND (
            cs.shared_with_user_id = auth.uid() OR
            cs.shared_with_group_id IN (
              SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
          )
        )
      )
    )
  );

CREATE POLICY "Users can update links in own or editable categories"
  ON links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = links.category_id
      AND (
        c.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM category_shares cs
          WHERE cs.category_id = c.id
          AND cs.permission_level = 'editor'
          AND (
            cs.shared_with_user_id = auth.uid() OR
            cs.shared_with_group_id IN (
              SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = links.category_id
      AND (
        c.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM category_shares cs
          WHERE cs.category_id = c.id
          AND cs.permission_level = 'editor'
          AND (
            cs.shared_with_user_id = auth.uid() OR
            cs.shared_with_group_id IN (
              SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
          )
        )
      )
    )
  );

CREATE POLICY "Users can delete links from own or editable categories"
  ON links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = links.category_id
      AND (
        c.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM category_shares cs
          WHERE cs.category_id = c.id
          AND cs.permission_level = 'editor'
          AND (
            cs.shared_with_user_id = auth.uid() OR
            cs.shared_with_group_id IN (
              SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Tags policies
CREATE POLICY "Authenticated users can read tags"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage all tags"
  ON tags FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Link tags policies
CREATE POLICY "Users can read link tags for accessible links"
  ON link_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM links l
      JOIN categories c ON c.id = l.category_id
      WHERE l.id = link_tags.link_id
      AND (
        c.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM category_shares cs
          WHERE cs.category_id = c.id
          AND (
            cs.shared_with_user_id = auth.uid() OR
            cs.shared_with_group_id IN (
              SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage tags on editable links"
  ON link_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM links l
      JOIN categories c ON c.id = l.category_id
      WHERE l.id = link_tags.link_id
      AND (
        c.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM category_shares cs
          WHERE cs.category_id = c.id
          AND cs.permission_level = 'editor'
          AND (
            cs.shared_with_user_id = auth.uid() OR
            cs.shared_with_group_id IN (
              SELECT group_id FROM group_members WHERE user_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Category shares policies
CREATE POLICY "Users can read shares for their categories"
  ON category_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = category_shares.category_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create shares for their categories"
  ON category_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = category_shares.category_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete shares for their categories"
  ON category_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = category_shares.category_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update shares for their categories"
  ON category_shares FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = category_shares.category_id
      AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM categories c
      WHERE c.id = category_shares.category_id
      AND c.owner_id = auth.uid()
    )
  );

-- Pinned links policies
CREATE POLICY "Users can read own pinned links"
  ON pinned_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own pinned links"
  ON pinned_links FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_owner ON categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_archived ON categories(is_archived);
CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id);
CREATE INDEX IF NOT EXISTS idx_category_shares_category ON category_shares(category_id);
CREATE INDEX IF NOT EXISTS idx_category_shares_user ON category_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_category_shares_group ON category_shares(shared_with_group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_links_user ON pinned_links(user_id);