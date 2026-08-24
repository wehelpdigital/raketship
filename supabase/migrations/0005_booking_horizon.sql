-- =============================================================================
-- RaketShip — how far ahead a calendar accepts bookings
-- =============================================================================
-- The public page offered a fixed fortnight and the server capped everything at
-- 60 days. Neither is a decision the code should be making: a dentist wants
-- months, a food stall wants this week only.
--
-- The upper bound stays in the database rather than in a form, so a calendar
-- cannot be edited into offering a decade of slots.
-- =============================================================================

alter table public.booking_calendars
  add column if not exists booking_horizon_days integer not null default 14;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_calendars_horizon_range'
  ) then
    alter table public.booking_calendars
      add constraint booking_calendars_horizon_range
      check (booking_horizon_days between 1 and 365);
  end if;
end;
$mig$;

comment on column public.booking_calendars.booking_horizon_days is
  'How many days ahead the public page offers, counting today as day 1.';
