-- =============================================================================
-- RaketShip — one length, or a catalogue of them
-- =============================================================================
-- A calendar either books one fixed length, or offers a list of services that
-- each carry their own price and length. In catalogue mode the length is not
-- known until the customer picks a service, which is why the service step comes
-- before the date on the public page: slots cannot be generated without it.
-- =============================================================================

alter table public.booking_calendars
  add column if not exists length_mode text not null default 'fixed';

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_calendars_length_mode'
  ) then
    alter table public.booking_calendars
      add constraint booking_calendars_length_mode
      check (length_mode in ('fixed', 'catalog'));
  end if;
end;
$mig$;

comment on column public.booking_calendars.length_mode is
  'fixed = duration_minutes applies to every booking; catalog = the chosen service decides.';

-- =============================================================================
-- services
-- =============================================================================
create table if not exists public.booking_services (
  id               uuid primary key default gen_random_uuid(),
  calendar_id      uuid not null references public.booking_calendars(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  -- Centavos, like every other price in the app. Zero means "ask" rather than
  -- free, which the UI words for itself.
  price_centavos   integer not null default 0 check (price_centavos >= 0),
  duration_minutes integer not null default 30
                   check (duration_minutes between 5 and 480),
  position         integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists booking_services_calendar_idx
  on public.booking_services (calendar_id, position);

drop trigger if exists booking_services_set_updated_at on public.booking_services;
create trigger booking_services_set_updated_at
  before update on public.booking_services
  for each row execute function public.set_updated_at();

-- =============================================================================
-- what was booked
-- =============================================================================
-- The name and price are snapshotted rather than only referenced: a service
-- renamed or repriced next month must not rewrite what someone agreed to, and
-- deleting one must not erase the booking's meaning.
alter table public.bookings
  add column if not exists service_id uuid
    references public.booking_services(id) on delete set null;
alter table public.bookings
  add column if not exists service_name text;
alter table public.bookings
  add column if not exists service_price_centavos integer;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.booking_services enable row level security;

drop policy if exists "own services" on public.booking_services;
create policy "own services" on public.booking_services
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The public booking page has to read these to offer them, but only while the
-- calendar they belong to is live.
drop policy if exists "published parent is public" on public.booking_services;
create policy "published parent is public" on public.booking_services
  for select using (
    exists (
      select 1 from public.booking_calendars c
      where c.id = booking_services.calendar_id and c.is_published = true
    )
  );
