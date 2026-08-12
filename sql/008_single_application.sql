-- 008: Enforce one application per election per user (safe migration)

-- Abort if duplicate candidate applications exist (same election_id & user_id applied to >1 positions)
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM public.candidates GROUP BY election_id, user_id HAVING count(*) > 1
  ) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate candidate groups (same election_id and user_id). Please resolve duplicates before creating unique index. To inspect duplicates run: SELECT election_id, user_id, array_agg(id ORDER BY created_at) ids, count(*) cnt FROM public.candidates GROUP BY election_id, user_id HAVING count(*) > 1;', dup_count;
  END IF;

  -- No duplicates found: create unique index to enforce one application per election per user
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_candidates_election_user ON public.candidates (election_id, user_id);
END
$$ LANGUAGE plpgsql;
