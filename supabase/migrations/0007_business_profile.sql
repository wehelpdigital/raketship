-- =============================================================================
-- RaketShip — Your Business
-- =============================================================================
-- Who the raket is: the name, the look, how to reach it, how to pay it, and
-- where it is. One row per user.
--
-- `business_name` is carried here as well as on public.profiles. That is the
-- one duplication in this schema and it is deliberate: public.profiles is
-- owner-only under RLS and also holds the email and the admin flag, and RLS
-- grants access by ROW rather than by column — so opening it to the anonymous
-- booking page would hand out the email along with the shop name. One save
-- action writes both copies in the same call, so they cannot drift.
-- =============================================================================

create table if not exists public.business_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Identity ----------------------------------------------------------------
  -- The publicly readable copy. profiles.business_name stays the one the
  -- dashboard and the account page read.
  business_name  text,
  tagline        text,
  description    text,
  business_type  text,

  -- Looks -------------------------------------------------------------------
  -- Storage object PATHS, not URLs. A signed URL would expire inside a link
  -- somebody already pasted into a Facebook post; the bucket is public and the
  -- path is turned into a URL at render time.
  logo_path      text,
  cover_path     text,
  -- A preset key, resolved through src/lib/theme/palettes.ts. Never a raw
  -- colour: an arbitrary hex carries no matched foreground and no dark-mode
  -- counterpart, so it breaks contrast in one mode or both.
  theme_preset   text not null default 'pula',

  -- Contact -----------------------------------------------------------------
  mobile_number      text,
  -- Which apps that same number can be reached on, so ticking a box turns a
  -- number already typed into tap-to-message buttons.
  chat_apps          text[] not null default '{}',
  facebook_url       text,
  instagram_handle   text,
  website_url        text,

  -- Payment -----------------------------------------------------------------
  gcash_number   text,
  maya_number    text,
  payment_name   text,
  payment_note   text,

  -- Where you are -----------------------------------------------------------
  street_address text,
  barangay       text,
  city           text,
  province       text,
  landmark       text,
  -- The same table serves a sari-sari store that wants to be found and a
  -- freelancer working from a bedroom. Defaulting to area-only means filling
  -- the address in can never publish a home address by accident.
  address_visibility text not null default 'area',

  hours_note     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_profiles_address_visibility'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_address_visibility
      check (address_visibility in ('full', 'area', 'hidden'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'business_profiles_lengths'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_lengths
      check (
        coalesce(length(tagline), 0) <= 60
        and coalesce(length(description), 0) <= 600
        and coalesce(length(payment_note), 0) <= 300
        and coalesce(length(hours_note), 0) <= 120
        and coalesce(array_length(chat_apps, 1), 0) <= 8
      );
  end if;
end;
$mig$;

-- A database created before this column existed needs it added rather than
-- declared, and the create above is a no-op there.
alter table public.business_profiles
  add column if not exists business_name text;

comment on column public.business_profiles.business_name is
  'Public copy of profiles.business_name. profiles is owner-only under RLS, so the anonymous booking page cannot read the name there.';

comment on column public.business_profiles.theme_preset is
  'Key into src/lib/theme/palettes.ts. Not validated here on purpose: a palette removed from the app must degrade to the default, not lock the row.';

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.business_profiles enable row level security;

drop policy if exists "own business profile" on public.business_profiles;
create policy "own business profile" on public.business_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The public booking page has to brand itself, and it runs for a stranger with
-- no session. Readable only while this user actually has a live booking link:
-- publishing a calendar is the act that makes a business public, so it is the
-- act that opens this row.
drop policy if exists "published owner is public" on public.business_profiles;
create policy "published owner is public" on public.business_profiles
  for select using (
    exists (
      select 1 from public.booking_calendars c
      where c.user_id = business_profiles.user_id
        and c.is_published = true
    )
  );

-- =============================================================================
-- Logo and cover
-- =============================================================================
-- Public, unlike booking-uploads. These images are the header of a page anyone
-- with the link can open, and they get unfurled by Messenger and Viber from
-- their own servers — a private bucket would show a broken image in the
-- preview card that is the whole first impression.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media', 'business-media', true, 5242880,
  array['image/png','image/jpeg','image/webp','image/avif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Filed under <owner-uuid>/..., the same shape 0004 uses, so the owner writes
-- only inside their own folder.
drop policy if exists "owner writes business media" on storage.objects;
create policy "owner writes business media" on storage.objects
  for insert with check (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The bucket is public, and the API needs to SELECT an object before it can
-- update or delete it. Without this the owner's own remove came back 403 and
-- every replaced logo stayed behind as an orphan while the row said otherwise.
drop policy if exists "business media is public" on storage.objects;
create policy "business media is public" on storage.objects
  for select using (bucket_id = 'business-media');

drop policy if exists "owner replaces business media" on storage.objects;
create policy "owner replaces business media" on storage.objects
  for update using (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner removes business media" on storage.objects;
create policy "owner removes business media" on storage.objects
  for delete using (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- The module itself
-- =============================================================================
-- sort_order -1 puts it above Booking, and is_default = true means
-- handle_new_user provisioning hands it to every new account without anyone
-- having to visit the marketplace. It is identity, not an add-on.
insert into public.modules
  (id, name, tagline, description, icon, category, accent, is_default, is_available, sort_order)
values
  ('business', 'Your Business', 'Who your raket is',
   'Your name, logo, colours and contact details — the identity every other module borrows from.',
   'Store', 'operations', 'chart-1', true, true, -1)
on conflict (id) do update set
  name         = excluded.name,
  tagline      = excluded.tagline,
  description  = excluded.description,
  icon         = excluded.icon,
  accent       = excluded.accent,
  is_default   = excluded.is_default,
  is_available = excluded.is_available,
  sort_order   = excluded.sort_order;

-- Existing accounts predate the module, so provisioning never ran for them.
insert into public.user_modules (user_id, module_id, status)
select p.id, 'business', 'active'
from public.profiles p
on conflict (user_id, module_id) do nothing;

-- Everyone who already has an account gets the row too, so the module opens on
-- a saved default rather than on nothing.
insert into public.business_profiles (user_id, business_name)
select p.id, p.business_name from public.profiles p
on conflict (user_id) do update set
  business_name = coalesce(
    public.business_profiles.business_name,
    excluded.business_name
  );
