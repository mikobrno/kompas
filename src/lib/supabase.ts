import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'user';
          theme: 'light' | 'dark';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: 'admin' | 'user';
          theme?: 'light' | 'dark';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'admin' | 'user';
          theme?: 'light' | 'dark';
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          is_archived: boolean;
          display_order: number;
          created_at: string;
          color_hex: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          is_archived?: boolean;
          display_order?: number;
          created_at?: string;
          color_hex?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          is_archived?: boolean;
          display_order?: number;
          created_at?: string;
          color_hex?: string;
        };
      };
      links: {
        Row: {
          id: string;
          category_id: string;
          display_name: string;
          url: string;
          favicon_url: string | null;
          is_archived: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          display_name: string;
          url: string;
          favicon_url?: string | null;
          is_archived?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          display_name?: string;
          url?: string;
          favicon_url?: string | null;
          is_archived?: boolean;
          display_order?: number;
          created_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      link_tags: {
        Row: {
          link_id: string;
          tag_id: string;
        };
        Insert: {
          link_id: string;
          tag_id: string;
        };
        Update: {
          link_id?: string;
          tag_id?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
        };
      };
      category_shares: {
        Row: {
          id: string;
          category_id: string;
          shared_with_user_id: string | null;
          shared_with_group_id: string | null;
          permission_level: 'viewer' | 'editor';
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          shared_with_user_id?: string | null;
          shared_with_group_id?: string | null;
          permission_level: 'viewer' | 'editor';
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          shared_with_user_id?: string | null;
          shared_with_group_id?: string | null;
          permission_level?: 'viewer' | 'editor';
          created_at?: string;
        };
      };
      link_shares: {
        Row: {
          id: string;
          link_id: string;
          shared_with_user_id: string | null;
          shared_with_group_id: string | null;
          permission_level: 'viewer' | 'editor';
          created_at: string;
        };
        Insert: {
          id?: string;
          link_id: string;
          shared_with_user_id?: string | null;
          shared_with_group_id?: string | null;
          permission_level: 'viewer' | 'editor';
          created_at?: string;
        };
        Update: {
          id?: string;
          link_id?: string;
          shared_with_user_id?: string | null;
          shared_with_group_id?: string | null;
          permission_level?: 'viewer' | 'editor';
          created_at?: string;
        };
      };
      pinned_links: {
        Row: {
          user_id: string;
          link_id: string;
          display_order: number;
        };
        Insert: {
          user_id: string;
          link_id: string;
          display_order?: number;
        };
        Update: {
          user_id?: string;
          link_id?: string;
          display_order?: number;
        };
      };
    };
  };
};
