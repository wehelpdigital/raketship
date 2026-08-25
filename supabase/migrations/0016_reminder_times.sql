-- =============================================================================
-- RaketShip — which reminders a calendar sends, from a fixed menu
-- =============================================================================
-- 0015 stored ONE lead as free minutes, picked from hour/minute dropdowns.
-- That put the owner in charge of a number nobody plans in numbers: reminders
-- come at the times reminders come — the day before, the same morning, and
-- just before — so the setting becomes three switches over a fixed menu, and
-- the picker goes.
--
-- Three columns rather than an array: a switch per row is impossible to hold
-- wrong, needs no constraint beyond its type, and the menu is the product's
-- to change, not the row's.
--
-- 24h defaults ON — it carries the promise the old default (1440 minutes)
-- made, so no existing calendar goes quiet. The other two default OFF: a suki
-- who booked yesterday for tomorrow does not want three emails overnight
-- unless the owner chose that.
-- =============================================================================

alter table public.booking_calendars
  add column if not exists reminder_24h boolean not null default true;

alter table public.booking_calendars
  add column if not exists reminder_8h boolean not null default false;

alter table public.booking_calendars
  add column if not exists reminder_15m boolean not null default false;

-- The free-form lead goes, constraint and all. Only its default ever shipped,
-- and the 24h switch above carries that promise forward.
alter table public.booking_calendars
  drop constraint if exists booking_calendars_reminder_lead;

alter table public.booking_calendars
  drop column if exists reminder_lead_minutes;

comment on column public.booking_calendars.reminder_24h is
  'Send a reminder email 24 hours before the appointment. Read at send time alongside send_reminder_email.';
comment on column public.booking_calendars.reminder_8h is
  'Send a reminder email 8 hours before the appointment.';
comment on column public.booking_calendars.reminder_15m is
  'Send a reminder email 15 minutes before the appointment.';
