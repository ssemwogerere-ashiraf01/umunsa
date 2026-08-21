update public.profiles
set membership_card_number = 'NSA-' || lpad(nextval('public.membership_card_seq')::text, 6, '0'),
    card_issued_at = coalesce(card_issued_at, now())
where membership_status = 'active'
  and membership_card_number is null;
