-- =============================================================================
-- RaketShip — initial schema
-- =============================================================================
-- Model
--   profiles       one row per auth user
--   plans          subscription tiers (free, basic)
--   subscriptions  which plan a user is on (one active row per user)
--   modules        marketplace catalogue ("Booking", "Product Catalog", ...)
--   module_tiers   per-module upgrade levels (starter / plus / pro)
--   user_modules   which modules a user activated, and at which tier
--   rakets         a user's business workspace
--   flows          a canvas. kind='raket' is the outer "Build your Raket" board;
--                  kind='module' is the inner builder for one placed module.
--   flow_nodes     elements on a canvas
--   flow_edges     connections between elements
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- helper: updated_at ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- =============================================================================
-- profiles
-- =============================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  business_name text,
  is_admin      boolean not null default false,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- plans  (catalogue — world readable)
-- =============================================================================
create table if not exists public.plans (
  id              text primary key,          -- 'free' | 'basic'
  name            text not null,
  tagline         text,
  description     text,
  price_centavos  integer not null default 0,
  billing_period  text not null default 'month',
  features        jsonb not null default '[]'::jsonb,
  module_slots    integer not null default 1, -- how many modules may be active
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- =============================================================================
-- subscriptions
-- =============================================================================
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  plan_id            text not null references public.plans(id),
  status             text not null default 'active'
                     check (status in ('active','past_due','cancelled')),
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- modules  (marketplace catalogue — world readable)
-- =============================================================================
create table if not exists public.modules (
  id             text primary key,           -- 'booking', 'product-catalog', ...
  name           text not null,
  tagline        text,
  description    text,
  icon           text not null default 'Boxes',
  category       text not null default 'operations',
  accent         text not null default 'chart-1',
  is_default     boolean not null default false, -- auto-granted on signup
  is_available   boolean not null default true,  -- false = "coming soon"
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.module_tiers (
  id             uuid primary key default gen_random_uuid(),
  module_id      text not null references public.modules(id) on delete cascade,
  key            text not null,              -- 'starter' | 'plus' | 'pro'
  name           text not null,
  description    text,
  price_centavos integer not null default 0,
  level          integer not null default 1, -- ordering; higher = better
  features       jsonb not null default '[]'::jsonb,
  node_types     jsonb not null default '[]'::jsonb, -- builder elements unlocked
  created_at     timestamptz not null default now(),
  unique (module_id, key)
);

create index if not exists module_tiers_module_id_idx on public.module_tiers(module_id);

-- =============================================================================
-- user_modules
-- =============================================================================
create table if not exists public.user_modules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  module_id    text not null references public.modules(id) on delete cascade,
  tier_id      uuid references public.module_tiers(id) on delete set null,
  status       text not null default 'active'
               check (status in ('active','paused')),
  activated_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, module_id)
);

create index if not exists user_modules_user_id_idx on public.user_modules(user_id);

drop trigger if exists user_modules_set_updated_at on public.user_modules;
create trigger user_modules_set_updated_at
  before update on public.user_modules
  for each row execute function public.set_updated_at();

-- =============================================================================
-- rakets  +  flows  +  nodes  +  edges
-- =============================================================================
create table if not exists public.rakets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'My Raket',
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists rakets_user_id_idx on public.rakets(user_id);

drop trigger if exists rakets_set_updated_at on public.rakets;
create trigger rakets_set_updated_at
  before update on public.rakets
  for each row execute function public.set_updated_at();

create table if not exists public.flows (
  id             uuid primary key default gen_random_uuid(),
  raket_id       uuid not null references public.rakets(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           text not null check (kind in ('raket','module')),
  module_id      text references public.modules(id) on delete cascade,
  parent_node_id uuid,   -- flow_nodes.id on the outer canvas (FK added below)
  name           text not null default 'Flow',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists flows_raket_id_idx on public.flows(raket_id);
create index if not exists flows_user_id_idx on public.flows(user_id);
-- one outer canvas per raket
create unique index if not exists flows_one_raket_canvas
  on public.flows(raket_id) where kind = 'raket';
-- one inner canvas per placed module node
create unique index if not exists flows_one_module_canvas
  on public.flows(parent_node_id) where parent_node_id is not null;

drop trigger if exists flows_set_updated_at on public.flows;
create trigger flows_set_updated_at
  before update on public.flows
  for each row execute function public.set_updated_at();

create table if not exists public.flow_nodes (
  id         uuid primary key default gen_random_uuid(),
  flow_id    uuid not null references public.flows(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  node_key   text not null,   -- stable client-side id used by React Flow
  type       text not null,   -- 'module' | 'booking' | 'timer' | 'email' | ...
  module_id  text references public.modules(id) on delete cascade,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, node_key)
);

create index if not exists flow_nodes_flow_id_idx on public.flow_nodes(flow_id);

drop trigger if exists flow_nodes_set_updated_at on public.flow_nodes;
create trigger flow_nodes_set_updated_at
  before update on public.flow_nodes
  for each row execute function public.set_updated_at();

-- now that flow_nodes exists, wire the self-referencing FK for inner canvases
do $mig$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'flows_parent_node_id_fkey'
  ) then
    alter table public.flows
      add constraint flows_parent_node_id_fkey
      foreign key (parent_node_id) references public.flow_nodes(id) on delete cascade;
  end if;
end;
$mig$;

create table if not exists public.flow_edges (
  id          uuid primary key default gen_random_uuid(),
  flow_id     uuid not null references public.flows(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  edge_key    text not null,
  source_key  text not null,
  target_key  text not null,
  label       text,
  animated    boolean not null default true,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (flow_id, edge_key)
);

create index if not exists flow_edges_flow_id_idx on public.flow_edges(flow_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles      enable row level security;
alter table public.plans         enable row level security;
alter table public.subscriptions enable row level security;
alter table public.modules       enable row level security;
alter table public.module_tiers  enable row level security;
alter table public.user_modules  enable row level security;
alter table public.rakets        enable row level security;
alter table public.flows         enable row level security;
alter table public.flow_nodes    enable row level security;
alter table public.flow_edges    enable row level security;

-- catalogue: readable by anyone (drives the public pricing/marketplace page)
drop policy if exists "plans are readable" on public.plans;
create policy "plans are readable" on public.plans for select using (true);

drop policy if exists "modules are readable" on public.modules;
create policy "modules are readable" on public.modules for select using (true);

drop policy if exists "module tiers are readable" on public.module_tiers;
create policy "module tiers are readable" on public.module_tiers for select using (true);

-- profiles: own row only
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = id);

-- everything else: own rows, all verbs
do $rls$
declare t text;
begin
  foreach t in array array[
    'subscriptions','user_modules','rakets','flows','flow_nodes','flow_edges'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'own rows select', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      'own rows select', t);

    execute format('drop policy if exists %I on public.%I', 'own rows insert', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      'own rows insert', t);

    execute format('drop policy if exists %I on public.%I', 'own rows update', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      'own rows update', t);

    execute format('drop policy if exists %I on public.%I', 'own rows delete', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      'own rows delete', t);
  end loop;
end;
$rls$;
