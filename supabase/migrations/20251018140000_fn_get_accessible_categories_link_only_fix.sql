/*
  Safety no-op: later migration 20251018153000 creates the full RPC
  with link_shares + impersonation. This file intentionally does nothing
  to avoid double definition and parsing edge-cases.
*/
DO $$ BEGIN
  PERFORM 1;
END $$;