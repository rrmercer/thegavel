CREATE OR REPLACE VIEW vote_counts AS
  SELECT poll_id, COUNT(*) AS total
  FROM votes
  GROUP BY poll_id;
