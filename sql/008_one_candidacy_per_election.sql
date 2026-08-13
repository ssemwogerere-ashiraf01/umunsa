-- 008: Enforce one application per election per user
create unique index if not exists uniq_candidates_election_user on public.candidates (election_id, user_id);
