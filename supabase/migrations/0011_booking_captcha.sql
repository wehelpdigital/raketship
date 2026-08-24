-- =============================================================================
-- RaketShip — proving a booking came from a person
-- =============================================================================
-- Every public booking form carries a challenge. It is not optional and it is
-- not in the form builder: a raketero should not have to know what a bot is,
-- and an owner who could switch it off would eventually be the one who did.
--
-- No third-party captcha. Those need an account, two API keys and a script from
-- someone else's domain on a page that Filipino MSMEs open on mobile data — and
-- the app has to keep working when nothing is configured. So the challenge is
-- issued and verified here, with nothing to sign up for.
--
-- This table exists for ONE property the signature cannot give on its own:
-- single use. A signed token proves we minted it and says when; it cannot stop
-- the same token being replayed a thousand times. Consuming the nonce does.
-- =============================================================================

create table if not exists public.booking_challenges (
  -- The nonce IS the key. A second insert of the same one is a replay, and the
  -- primary key refuses it without needing a read first.
  nonce      text primary key,
  used_at    timestamptz not null default now()
);

-- Consumed nonces are worthless the moment their token would have expired
-- anyway; this index is what makes the sweep cheap.
create index if not exists booking_challenges_used_at_idx
  on public.booking_challenges (used_at);

comment on table public.booking_challenges is
  'Spent captcha nonces. Rows older than the token lifetime can be deleted at any time.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.booking_challenges enable row level security;

-- The booking action runs as the anonymous visitor, so it has to be able to
-- spend a nonce. It must NOT be able to read the table: whether a given nonce
-- has been used is not a stranger's business, and being able to list them would
-- turn this into a way to enumerate booking attempts.
drop policy if exists "anyone spends a nonce" on public.booking_challenges;
create policy "anyone spends a nonce" on public.booking_challenges
  for insert with check (true);

-- =============================================================================
-- Sweeping up
-- =============================================================================
-- Called opportunistically rather than scheduled: pg_cron is not available on
-- every plan, and a table of short-lived nonces does not deserve a dependency.
create or replace function public.sweep_booking_challenges(older_than interval)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.booking_challenges
  where used_at < now() - older_than;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.sweep_booking_challenges(interval) from public;
grant execute on function public.sweep_booking_challenges(interval) to anon, authenticated;
