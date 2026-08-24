-- =============================================================================
-- RaketShip — framing the cover photo too
-- =============================================================================
-- The cover is cropped to a 3:1 banner, which throws away most of a portrait
-- photo taken on a phone. It gets the same three numbers the logo has, and the
-- same meaning: object-position picks the point, scale magnifies from it.
-- =============================================================================

alter table public.business_profiles
  add column if not exists cover_zoom real not null default 1;
alter table public.business_profiles
  add column if not exists cover_x smallint not null default 50;
alter table public.business_profiles
  add column if not exists cover_y smallint not null default 50;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_profiles_cover_crop'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_cover_crop
      check (
        cover_zoom >= 1 and cover_zoom <= 4
        and cover_x between 0 and 100
        and cover_y between 0 and 100
      );
  end if;
end;
$mig$;
