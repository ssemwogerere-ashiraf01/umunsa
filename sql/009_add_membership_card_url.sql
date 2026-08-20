-- sql/009_add_membership_card_url.sql
-- Add a column to profiles to store the public URL of a generated membership card image.
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_card_url text;

-- Optional: you may want to index or comment this column in future migrations.
