-- =============================================================================
-- RaketShip — trimming Your Business back
-- =============================================================================
-- Business type, open hours and the whole payment block are gone. Every box on
-- this form is another thing to fill in on a phone, and these four were the
-- ones a raketero could skip without the page losing anything:
--
--   business_type  — nothing read it yet; it was a promise, not a feature.
--   hours_note     — booking_availability is the real answer to "kailan",
--                    and two answers to one question is worse than one.
--   gcash/maya/payment_name/payment_note — money belongs to the Payments
--                    module, not to an identity form.
--
-- Verified empty across every row before dropping, so nothing was discarded.
-- =============================================================================

-- The length constraint names two of the columns below, so it has to go first
-- or the drops fail.
alter table public.business_profiles
  drop constraint if exists business_profiles_lengths;

alter table public.business_profiles drop column if exists business_type;
alter table public.business_profiles drop column if exists hours_note;
alter table public.business_profiles drop column if exists gcash_number;
alter table public.business_profiles drop column if exists maya_number;
alter table public.business_profiles drop column if exists payment_name;
alter table public.business_profiles drop column if exists payment_note;

-- Landmark became a textarea in the form: "katapat ng Mercury Drug, tapat ng
-- barangay hall, kulay dilaw na gate" is how directions are actually given
-- here, and that does not fit on one line.
do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_profiles_lengths'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_lengths
      check (
        coalesce(length(tagline), 0) <= 60
        and coalesce(length(description), 0) <= 600
        and coalesce(length(landmark), 0) <= 300
        and coalesce(array_length(chat_apps, 1), 0) <= 8
      );
  end if;
end;
$mig$;
