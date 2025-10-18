-- Add soft-archive flag to links
ALTER TABLE links ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_links_archived ON links(is_archived);
