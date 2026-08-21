-- sql/008_assign_existing_membership_cards.sql
-- Assign sequential membership_card_number values to existing active members
-- who missed assignment when migration 007 ran earlier.
--
-- Safe, idempotent migration: running this multiple times will not reassign
-- numbers that already exist. It will only assign numbers to rows where
-- membership_status = 'active' and membership_card_number IS NULL or ''.
--
-- IMPORTANT: Back up your database before running. Test in staging first.

BEGIN;

-- Ensure sequence exists (migration 007 normally creates this).
CREATE SEQUENCE IF NOT EXISTS public.membership_card_seq START 1;

-- Compute current maximum numeric suffix used in membership_card_number.
-- membership_card_number has format NSA-000123
WITH max_num AS (
  SELECT COALESCE(MAX((regexp_replace(membership_card_number, '^.*-', '') )::integer), 0) AS n
  FROM public.profiles
  WHERE membership_card_number ~ '^NSA-[0-9]+$'
)
-- Advance the sequence so nextval() will produce max_num + 1.
SELECT setval('public.membership_card_seq', (SELECT n FROM max_num), true);

-- Assign card numbers to active members missing one. Use nextval() for each
-- row so values are unique and sequential according to the sequence.
-- Also set card_issued_at if not already present.
WITH to_update AS (
  SELECT id
  FROM public.profiles
  WHERE membership_status = 'active'
    AND (membership_card_number IS NULL OR membership_card_number = '')
  FOR UPDATE
)
UPDATE public.profiles p
SET
  membership_card_number = 'NSA-' || lpad(nextval('public.membership_card_seq')::text, 6, '0'),
  card_issued_at = COALESCE(p.card_issued_at, now())
FROM to_update tu
WHERE p.id = tu.id
RETURNING p.id, p.membership_card_number;

COMMIT;

-- Notes:
-- - This migration will not touch members whose membership_card_number is
--   already present. It only sets numbers for currently-active members who
--   don't have one.
-- - If you prefer to preview which rows would be affected first, run:
--     SELECT id, full_name, membership_status, membership_card_number
--     FROM public.profiles
--     WHERE membership_status = 'active' AND (membership_card_number IS NULL OR membership_card_number = '');
-- - After running, verify there are no gaps or collisions by checking the
--   sequence vs stored values:
--     SELECT setval('public.membership_card_seq', COALESCE((SELECT MAX((regexp_replace(membership_card_number, '^.*-', '') )::int) FROM public.profiles WHERE membership_card_number ~ '^NSA-[0-9]+$'),0), true);