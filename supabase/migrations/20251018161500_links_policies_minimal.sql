-- No-op migration to bypass previous invalid procedural block. Effective policies are created in 20251018162000_links_policies_minimal_fix.sql
DO $$ BEGIN PERFORM 1; END $$;
