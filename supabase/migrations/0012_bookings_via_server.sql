-- =============================================================================
-- RaketShip — bookings come through the server, not straight at the table
-- =============================================================================
-- 0004 let anyone insert a booking on a published calendar, so that the public
-- page could work with the anonymous key. That was fine while the only guard
-- worth having was RLS. It stopped being fine the moment a booking had to pass
-- an anti-robot check: a script could POST at PostgREST and skip the form
-- entirely, and a captcha you can walk around is decoration.
--
-- Measured before changing anything: an anonymous insert naming the calendar's
-- own owner returned 201. The owner id is on the public page, so that was not
-- a secret to guess.
--
-- The public page now books through submitBooking(), which re-derives the slot,
-- re-validates every answer, verifies the challenge and spends its nonce — and
-- writes with the service key. Anonymous callers keep every READ they had; they
-- simply no longer have a way in that misses the checks.
-- =============================================================================

drop policy if exists "anyone books a published calendar" on public.bookings;

comment on table public.bookings is
  'Written only by the server. submitBooking() authorises the caller and writes with the service key; there is deliberately no anonymous insert policy.';

-- Same reasoning: a nonce is spent by the server as part of verifying it, and
-- letting anyone else spend one only ever burns somebody else''s token.
drop policy if exists "anyone spends a nonce" on public.booking_challenges;

comment on table public.booking_challenges is
  'Spent captcha nonces. Written only by the server. Rows older than the token lifetime can be deleted at any time.';
