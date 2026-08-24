-- =============================================================================
-- RaketShip — where the logo sits inside its circle
-- =============================================================================
-- The logo is masked to a circle everywhere it appears. A photo taken on a
-- phone is rarely square and almost never centred on the thing that matters,
-- so the owner gets to say which part shows: pan to a point, zoom in on it.
--
-- Three numbers is the whole model:
--
--   logo_x / logo_y  the point of the image to keep in view, as a percentage
--                    of its width and height. This is CSS object-position.
--   logo_zoom        how far to magnify, anchored on that same point.
--
-- Stored rather than baked into the file: the original is never re-encoded, so
-- the framing stays adjustable and a mistake costs nothing.
-- =============================================================================

alter table public.business_profiles
  add column if not exists logo_zoom real not null default 1;
alter table public.business_profiles
  add column if not exists logo_x smallint not null default 50;
alter table public.business_profiles
  add column if not exists logo_y smallint not null default 50;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_profiles_logo_crop'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_logo_crop
      check (
        logo_zoom >= 1 and logo_zoom <= 4
        and logo_x between 0 and 100
        and logo_y between 0 and 100
      );
  end if;
end;
$mig$;

comment on column public.business_profiles.logo_zoom is
  'CSS transform scale, 1 to 4. Anchored on (logo_x, logo_y) so zooming keeps the chosen point in view.';
comment on column public.business_profiles.logo_x is
  'CSS object-position X, 0-100. The mask is always filled because the image is object-fit: cover and the scale never goes below 1.';
