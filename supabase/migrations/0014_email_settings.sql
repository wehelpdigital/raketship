-- =============================================================================
-- RaketShip — whether a calendar sends its emails
-- =============================================================================
-- Two switches, not a config tree: the confirmation that goes out when a
-- booking lands, and the reminder that goes out before the appointment. Both
-- default ON — the module's whole pitch is Booking → Timer → Email working out
-- of the box, and a default that silently sent nothing would make the pitch a
-- lie for every calendar made before the owner found the setting.
--
-- These are the OWNER's switches. The sending pipeline reads them at send
-- time, so flipping one off stops future sends without touching anything
-- already queued by a flow.
-- =============================================================================

alter table public.booking_calendars
  add column if not exists send_confirmation_email boolean not null default true;

alter table public.booking_calendars
  add column if not exists send_reminder_email boolean not null default true;

comment on column public.booking_calendars.send_confirmation_email is
  'Send the suki a confirmation email when their booking lands. Owner-facing switch; the sender checks it at send time.';

comment on column public.booking_calendars.send_reminder_email is
  'Send the suki a reminder email before the appointment. Owner-facing switch; the sender checks it at send time.';
