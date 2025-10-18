-- Backfill timestamps on auth.identities to prevent GoTrue scan errors.
UPDATE auth.identities
SET
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW()),
  last_sign_in_at = COALESCE(last_sign_in_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL OR last_sign_in_at IS NULL;
