-- =============================================================================
-- RaketShip — how long before the appointment the reminder goes out
-- =============================================================================
-- Minutes, like every other span on a calendar row: the owner picks hours and
-- minutes in the UI, but a single integer is the only shape that cannot
-- disagree with itself.
--
-- Default 1440 — the day before. That is what a reminder means to most shops,
-- and every calendar from before this column behaves as if its owner had
-- picked it.
--
-- The floor of 10 exists because a reminder sent zero minutes before the
-- appointment is the appointment; the ceiling of a week keeps a typo from
-- scheduling a reminder into a different month.
-- =============================================================================

alter table public.booking_calendars
  add column if not exists reminder_lead_minutes integer not null default 1440;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_calendars_reminder_lead'
  ) then
    alter table public.booking_calendars
      add constraint booking_calendars_reminder_lead
      check (reminder_lead_minutes between 10 and 10080);
  end if;
end;
$mig$;

comment on column public.booking_calendars.reminder_lead_minutes is
  'Minutes before the appointment that the reminder email is sent. Read at send time alongside send_reminder_email.';
