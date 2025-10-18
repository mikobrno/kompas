-- Seeded auth.users rows need timestamps to satisfy GoTrue's struct decoding.
-- Backfill missing timestamps for created_at/updated_at to avoid null scan errors.
UPDATE auth.users SET created_at = NOW() WHERE created_at IS NULL;
UPDATE auth.users SET updated_at = NOW() WHERE updated_at IS NULL;
