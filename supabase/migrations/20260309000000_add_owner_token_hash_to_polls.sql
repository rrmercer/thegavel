-- F2: Add owner token hash to polls for poll management
-- The hash is stored server-side only and never returned to the client.
-- SHA-256 of a UUID (128 bits of entropy) is appropriate here.
ALTER TABLE polls
  ADD COLUMN owner_token_hash TEXT NOT NULL DEFAULT '';

-- Remove the temporary default so future inserts must supply the value.
ALTER TABLE polls
  ALTER COLUMN owner_token_hash DROP DEFAULT;
