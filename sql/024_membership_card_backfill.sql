-- 024: Backfill membership card numbers
--
-- sql/007_membership_card.sql assigns a membership_card_number via a
-- BEFORE INSERT OR UPDATE trigger, which only fires on new rows or rows
-- being changed. Any member who was already membership_status = 'active'
-- *before* 007 was run never triggers that logic, so their card number
-- stays null forever and "Generate" stays disabled for them on
-- admin/membership-id.html. This is a one-time catch-up for those rows.
--
-- Safe to re-run: only touches rows that are active AND still missing a
-- card number.

update public.profiles
set membership_card_number = 'NSA-' || lpad(nextval('public.membership_card_seq')::text, 6, '0'),
    card_issued_at = coalesce(card_issued_at, now())
where membership_status = 'active'
  and membership_card_number is null;
