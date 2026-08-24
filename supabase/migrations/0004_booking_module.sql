-- =============================================================================
-- RaketShip — Booking module
-- =============================================================================
--   booking_calendars     one bookable thing, with its own public slug
--   booking_availability  which weekdays and hours it accepts, in its timezone
--   booking_blackouts     specific dates it does not, whatever the weekly rule
--   booking_form_fields   the questions asked at booking time
--   bookings              what customers submitted
--
-- The public booking page is unauthenticated, so the read policies below let
-- anon see a calendar ONLY while it is published, and insert a booking only
-- against a published calendar. Everything else stays owner-only.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- calendars
-- =============================================================================
create table if not exists public.booking_calendars (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  slug             text not null,
  -- IANA zone ("Asia/Manila") plus the ISO country it was picked from, so the
  -- picker can show a sensible default without re-deriving it.
  timezone         text not null default 'Asia/Manila',
  country          text not null default 'PH',
  duration_minutes integer not null default 30
                   check (duration_minutes between 5 and 480),
  buffer_minutes   integer not null default 0
                   check (buffer_minutes between 0 and 240),
  notice_hours     integer not null default 2 check (notice_hours >= 0),
  is_published     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Slugs live in one public namespace, so they are unique across all users.
create unique index if not exists booking_calendars_slug_key
  on public.booking_calendars (lower(slug));
create index if not exists booking_calendars_user_id_idx
  on public.booking_calendars (user_id);

drop trigger if exists booking_calendars_set_updated_at on public.booking_calendars;
create trigger booking_calendars_set_updated_at
  before update on public.booking_calendars
  for each row execute function public.set_updated_at();

-- =============================================================================
-- weekly availability
-- =============================================================================
create table if not exists public.booking_availability (
  id           uuid primary key default gen_random_uuid(),
  calendar_id  uuid not null references public.booking_calendars(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- 0 = Sunday, matching JS getDay().
  weekday      smallint not null check (weekday between 0 and 6),
  -- Minutes from midnight keeps arithmetic trivial and dodges timezone-typed
  -- columns entirely; the calendar's own timezone gives them meaning.
  start_minute integer not null check (start_minute between 0 and 1440),
  end_minute   integer not null check (end_minute between 0 and 1440),
  created_at   timestamptz not null default now(),
  constraint booking_availability_range check (end_minute > start_minute)
);

create index if not exists booking_availability_calendar_idx
  on public.booking_availability (calendar_id);

-- =============================================================================
-- blackout dates
-- =============================================================================
create table if not exists public.booking_blackouts (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.booking_calendars(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (calendar_id, date)
);

create index if not exists booking_blackouts_calendar_idx
  on public.booking_blackouts (calendar_id);

-- =============================================================================
-- form fields
-- =============================================================================
create table if not exists public.booking_form_fields (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.booking_calendars(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  type        text not null default 'short_text'
              check (type in (
                'short_text','long_text','email','phone','number',
                'select','multi_select','checkbox','date','upload'
              )),
  help        text,
  placeholder text,
  required    boolean not null default false,
  -- Choice labels for select / multi_select; ignored by the other types.
  options     jsonb not null default '[]'::jsonb,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists booking_form_fields_calendar_idx
  on public.booking_form_fields (calendar_id, position);

drop trigger if exists booking_form_fields_set_updated_at on public.booking_form_fields;
create trigger booking_form_fields_set_updated_at
  before update on public.booking_form_fields
  for each row execute function public.set_updated_at();

-- =============================================================================
-- bookings
-- =============================================================================
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  calendar_id    uuid not null references public.booking_calendars(id) on delete cascade,
  -- Denormalised owner so the owner's RLS policy needs no join.
  user_id        uuid not null references auth.users(id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  customer_name  text not null,
  customer_email text,
  customer_phone text,
  answers        jsonb not null default '{}'::jsonb,
  status         text not null default 'confirmed'
                 check (status in ('confirmed','cancelled')),
  created_at     timestamptz not null default now(),
  constraint bookings_range check (ends_at > starts_at)
);

create index if not exists bookings_calendar_idx
  on public.bookings (calendar_id, starts_at);
create index if not exists bookings_user_idx on public.bookings (user_id);

-- Two people must not take the same slot on the same calendar.
create unique index if not exists bookings_no_double_booking
  on public.bookings (calendar_id, starts_at)
  where status = 'confirmed';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.booking_calendars    enable row level security;
alter table public.booking_availability enable row level security;
alter table public.booking_blackouts    enable row level security;
alter table public.booking_form_fields  enable row level security;
alter table public.bookings             enable row level security;

-- --- calendars ---------------------------------------------------------------
drop policy if exists "own calendars" on public.booking_calendars;
create policy "own calendars" on public.booking_calendars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The public booking page reads this anonymously, but only while published.
drop policy if exists "published calendars are public" on public.booking_calendars;
create policy "published calendars are public" on public.booking_calendars
  for select using (is_published = true);

-- --- child tables: owner does anything; anyone may read a published parent ---
do $rls$
declare t text;
begin
  foreach t in array array[
    'booking_availability','booking_blackouts','booking_form_fields'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'own rows', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      'own rows', t);

    execute format('drop policy if exists %I on public.%I', 'published parent is public', t);
    execute format(
      'create policy %I on public.%I for select using (exists (
         select 1 from public.booking_calendars c
         where c.id = %I.calendar_id and c.is_published = true))',
      'published parent is public', t, t);
  end loop;
end;
$rls$;

-- --- bookings ----------------------------------------------------------------
drop policy if exists "owner reads bookings" on public.bookings;
create policy "owner reads bookings" on public.bookings
  for select using (auth.uid() = user_id);

drop policy if exists "owner manages bookings" on public.bookings;
create policy "owner manages bookings" on public.bookings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner deletes bookings" on public.bookings;
create policy "owner deletes bookings" on public.bookings
  for delete using (auth.uid() = user_id);

-- Anyone may book a published calendar, but the row they write must belong to
-- that calendar's owner — otherwise a caller could file bookings under someone
-- else's account.
drop policy if exists "anyone books a published calendar" on public.bookings;
create policy "anyone books a published calendar" on public.bookings
  for insert with check (
    exists (
      select 1 from public.booking_calendars c
      where c.id = calendar_id
        and c.is_published = true
        and c.user_id = bookings.user_id
    )
  );

-- =============================================================================
-- Uploads (the "upload" question type)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-uploads', 'booking-uploads', false, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone uploads a booking attachment" on storage.objects;
create policy "anyone uploads a booking attachment" on storage.objects
  for insert with check (bucket_id = 'booking-uploads');

-- Attachments are filed under <owner-uuid>/..., so the owner reads their own.
drop policy if exists "owner reads booking attachments" on storage.objects;
create policy "owner reads booking attachments" on storage.objects
  for select using (
    bucket_id = 'booking-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Slug helper — callable by the owner when creating a calendar
-- =============================================================================
create or replace function public.booking_slug_available(p_slug text)
returns boolean
language sql
security definer
set search_path = public
as $fn$
  select not exists (
    select 1 from public.booking_calendars where lower(slug) = lower(p_slug)
  );
$fn$;

revoke all on function public.booking_slug_available(text) from public;
grant execute on function public.booking_slug_available(text) to authenticated;
