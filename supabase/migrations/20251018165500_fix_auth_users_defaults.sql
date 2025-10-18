-- Supabase GoTrue expects confirmation_token to be non-null strings; seed script left NULL values.
-- Set default empty string and backfill existing NULLs.
UPDATE auth.users SET confirmation_token = '' WHERE confirmation_token IS NULL;
