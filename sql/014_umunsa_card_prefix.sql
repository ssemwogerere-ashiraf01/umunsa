-- 014: New membership card numbers use UMUNSA- prefix (existing NSA- numbers stay valid).
create or replace function public.assign_membership_card_number()
returns trigger
language plpgsql
as $$
begin
  if new.membership_status = 'active' and new.membership_card_number is null then
    new.membership_card_number := 'UMUNSA-' || lpad(nextval('public.membership_card_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

comment on column public.profiles.membership_card_number is
  'Sequential membership card number, e.g. UMUNSA-000123 (legacy NSA- still valid). Assigned when membership becomes active.';
