-- =============================================================================
-- RaketShip — how much warning a cancellation needs
-- =============================================================================
-- A public booking cannot be cancelled from the page that made it: there is no
-- account behind one and no way to prove who is asking. So the confirmation
-- tells the suki to message the shop — and this is how long before the
-- appointment the owner needs to hear about it.
--
-- Separate from notice_hours, which is the opposite end: that one is how far
-- ahead somebody must book. A salon might take a walk-in with no notice at all
-- and still want a day's warning before an empty chair.
--
-- Zero means "no particular deadline", and the page then simply asks them to
-- message rather than inventing a number.
-- =============================================================================

alter table public.booking_calendars
  add column if not exists cancel_notice_hours integer not null default 24;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_calendars_cancel_notice'
  ) then
    alter table public.booking_calendars
      add constraint booking_calendars_cancel_notice
      check (cancel_notice_hours between 0 and 720);
  end if;
end;
$mig$;

comment on column public.booking_calendars.cancel_notice_hours is
  'Hours before the appointment that a cancellation should reach the owner. 0 means no stated deadline. Shown on the booking confirmation; nothing enforces it, because nothing can.';
