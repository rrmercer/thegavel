-- F1: Poll expiry
-- Adds an optional close timestamp to polls.
-- NULL means the poll is open indefinitely.
ALTER TABLE polls ADD COLUMN closes_at TIMESTAMPTZ DEFAULT NULL;
