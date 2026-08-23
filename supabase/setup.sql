-- ============================================================================
-- RaketShip — ONE-PASTE SETUP
-- Open Supabase Dashboard -> SQL Editor -> New query, paste this whole file,
-- and hit Run. Safe to re-run.
-- ============================================================================

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
-- =============================================================================
-- RaketShip — catalogue seed (plans, modules, module tiers)
-- Idempotent: safe to re-run.
-- =============================================================================

-- --- plans -------------------------------------------------------------------
insert into public.plans
  (id, name, tagline, description, price_centavos, billing_period, module_slots, sort_order, features)
values
  ('free', 'Libre', 'Start your raket for free',
   'Everything you need to take your first bookings. No card required.',
   0, 'month', 1, 0,
   '["1 active module","Booking module included","Up to 20 bookings / month","RaketShip branding"]'::jsonb),

  ('basic', 'Basic', 'For the growing raket',
   'Unlock the marketplace and run up to 5 modules side by side.',
   29900, 'month', 5, 1,
   '["5 active modules","Full marketplace access","Unlimited bookings","Remove RaketShip branding","Email support"]'::jsonb)
on conflict (id) do update set
  name           = excluded.name,
  tagline        = excluded.tagline,
  description    = excluded.description,
  price_centavos = excluded.price_centavos,
  module_slots   = excluded.module_slots,
  sort_order     = excluded.sort_order,
  features       = excluded.features;

-- --- modules -----------------------------------------------------------------
insert into public.modules
  (id, name, tagline, description, icon, category, accent, is_default, is_available, sort_order)
values
  ('booking', 'Booking', 'Take appointments online',
   'Let suki book a slot, get a reminder, and receive a confirmation email — automatically.',
   'CalendarCheck', 'sales', 'chart-1', true, true, 0),

  ('product-catalog', 'Product Catalog', 'Show what you sell',
   'A mobile-friendly catalog of your products with photos, prices and stock badges.',
   'Package', 'sales', 'chart-3', false, true, 1),

  ('invoicing', 'Invoices & Receipts', 'Get paid properly',
   'Generate numbered invoices and official-looking receipts you can send over chat.',
   'ReceiptText', 'finance', 'chart-2', false, true, 2),

  ('crm', 'Customer List', 'Remember every suki',
   'Keep names, numbers and order history in one place instead of scattered chat threads.',
   'Users', 'relationships', 'chart-5', false, true, 3),

  ('loyalty', 'Loyalty & Points', 'Bring them back',
   'Digital punch cards and points that turn one-time buyers into regulars.',
   'Sparkles', 'relationships', 'chart-4', false, true, 4),

  ('inventory', 'Stock Tracker', 'Never oversell again',
   'Track stock levels per item and get a nudge when something is running low.',
   'Boxes', 'operations', 'chart-3', false, true, 5),

  ('payments', 'Online Payments', 'Accept GCash & cards',
   'Collect payment links so you stop chasing screenshots of proof of payment.',
   'CreditCard', 'finance', 'chart-2', false, true, 6),

  ('delivery', 'Delivery & Logistics', 'Move your goods',
   'Book riders, print labels and track parcels without leaving RaketShip.',
   'Truck', 'operations', 'chart-5', false, false, 7),

  ('analytics', 'Sales Insights', 'Know what sells',
   'Simple charts that answer: what sold, when, and to whom.',
   'ChartLine', 'insights', 'chart-4', false, false, 8)
on conflict (id) do update set
  name         = excluded.name,
  tagline      = excluded.tagline,
  description  = excluded.description,
  icon         = excluded.icon,
  category     = excluded.category,
  accent       = excluded.accent,
  is_default   = excluded.is_default,
  is_available = excluded.is_available,
  sort_order   = excluded.sort_order;

-- --- module tiers ------------------------------------------------------------
-- "Tingi" pricing: start at zero, pay only for the next notch you actually need.
insert into public.module_tiers
  (module_id, key, name, description, price_centavos, level, features, node_types)
values
  -- Booking ------------------------------------------------------------------
  ('booking', 'starter', 'Starter',
   'Take bookings, remind, confirm.', 0, 1,
   '["Booking form","Wait / delay timer","Email confirmation","20 bookings per month"]'::jsonb,
   '["booking","timer","email"]'::jsonb),

  ('booking', 'plus', 'Plus',
   'Add SMS nudges and branching rules.', 14900, 2,
   '["Everything in Starter","SMS reminders","Yes/no branching","Calendar sync","Unlimited bookings"]'::jsonb,
   '["booking","timer","email","sms","condition","calendar"]'::jsonb),

  ('booking', 'pro', 'Pro',
   'Collect deposits and assign staff.', 34900, 3,
   '["Everything in Plus","Collect payment on booking","Assign to staff","Webhooks","Priority support"]'::jsonb,
   '["booking","timer","email","sms","condition","calendar","payment","assign","webhook"]'::jsonb),

  -- Product Catalog ----------------------------------------------------------
  ('product-catalog', 'starter', 'Starter',
   'A simple list of what you sell.', 0, 1,
   '["Up to 20 products","Photo + price","Shareable link"]'::jsonb,
   '["catalog","product"]'::jsonb),

  ('product-catalog', 'plus', 'Plus',
   'Organise and discount.', 9900, 2,
   '["Everything in Starter","Product categories","Discounts & promo codes","Unlimited products"]'::jsonb,
   '["catalog","product","category","discount"]'::jsonb),

  ('product-catalog', 'pro', 'Pro',
   'Sell straight from the catalog.', 24900, 3,
   '["Everything in Plus","Online payment checkout","Stock sync","Abandoned cart nudge"]'::jsonb,
   '["catalog","product","category","discount","payment","stock"]'::jsonb),

  -- Invoicing ----------------------------------------------------------------
  ('invoicing', 'starter', 'Starter', 'Numbered invoices.', 0, 1,
   '["10 invoices per month","PDF export"]'::jsonb,
   '["invoice"]'::jsonb),
  ('invoicing', 'plus', 'Plus', 'Branding and reminders.', 9900, 2,
   '["Everything in Starter","Your logo","Payment reminders","Unlimited invoices"]'::jsonb,
   '["invoice","reminder","branding"]'::jsonb),
  ('invoicing', 'pro', 'Pro', 'Recurring billing.', 19900, 3,
   '["Everything in Plus","Recurring invoices","Partial payments","Accountant export"]'::jsonb,
   '["invoice","reminder","branding","recurring"]'::jsonb),

  -- CRM ----------------------------------------------------------------------
  ('crm', 'starter', 'Starter', 'Your customer list.', 0, 1,
   '["Up to 100 customers","Notes & tags"]'::jsonb, '["contact"]'::jsonb),
  ('crm', 'plus', 'Plus', 'Segments and history.', 9900, 2,
   '["Everything in Starter","Unlimited customers","Segments","Order history"]'::jsonb,
   '["contact","segment"]'::jsonb),
  ('crm', 'pro', 'Pro', 'Campaigns.', 19900, 3,
   '["Everything in Plus","Broadcast messages","Birthday automations"]'::jsonb,
   '["contact","segment","broadcast"]'::jsonb),

  -- Loyalty ------------------------------------------------------------------
  ('loyalty', 'starter', 'Starter', 'Digital punch card.', 0, 1,
   '["1 punch card","QR stamp"]'::jsonb, '["punchcard"]'::jsonb),
  ('loyalty', 'plus', 'Plus', 'Points and tiers.', 9900, 2,
   '["Everything in Starter","Points balance","Reward tiers"]'::jsonb,
   '["punchcard","points"]'::jsonb),
  ('loyalty', 'pro', 'Pro', 'Referrals.', 17900, 3,
   '["Everything in Plus","Referral tracking","Win-back offers"]'::jsonb,
   '["punchcard","points","referral"]'::jsonb),

  -- Inventory ----------------------------------------------------------------
  ('inventory', 'starter', 'Starter', 'Count your stock.', 0, 1,
   '["Up to 50 items","Low-stock badge"]'::jsonb, '["stock"]'::jsonb),
  ('inventory', 'plus', 'Plus', 'Alerts and movements.', 9900, 2,
   '["Everything in Starter","Low-stock alerts","Stock in/out log"]'::jsonb,
   '["stock","alert"]'::jsonb),
  ('inventory', 'pro', 'Pro', 'Multi-location.', 19900, 3,
   '["Everything in Plus","Multiple locations","Supplier reorder"]'::jsonb,
   '["stock","alert","location"]'::jsonb),

  -- Payments -----------------------------------------------------------------
  ('payments', 'starter', 'Starter', 'Send payment links.', 0, 1,
   '["Manual payment links","GCash / Maya QR"]'::jsonb, '["paylink"]'::jsonb),
  ('payments', 'plus', 'Plus', 'Auto-reconcile.', 14900, 2,
   '["Everything in Starter","Automatic confirmation","Card payments"]'::jsonb,
   '["paylink","autoconfirm"]'::jsonb),
  ('payments', 'pro', 'Pro', 'Payouts and split.', 29900, 3,
   '["Everything in Plus","Scheduled payouts","Split payments"]'::jsonb,
   '["paylink","autoconfirm","payout"]'::jsonb)
on conflict (module_id, key) do update set
  name           = excluded.name,
  description    = excluded.description,
  price_centavos = excluded.price_centavos,
  level          = excluded.level,
  features       = excluded.features,
  node_types     = excluded.node_types;
-- =============================================================================
-- RaketShip — new-user provisioning
-- =============================================================================
-- When someone signs up we want them to land on something that already works:
--   profile -> free subscription -> Booking module granted at Starter
--   -> a Raket with an outer canvas holding the Booking module node
--   -> that node's inner canvas pre-wired  Booking -> Timer -> Email
-- =============================================================================

create or replace function public.provision_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $prov$
declare
  v_raket_id        uuid;
  v_outer_flow_id   uuid;
  v_module_node_id  uuid;
  v_inner_flow_id   uuid;
  v_tier_id         uuid;
  v_module          record;
begin
  -- 1. free subscription -----------------------------------------------------
  insert into public.subscriptions (user_id, plan_id, status)
  values (p_user_id, 'free', 'active')
  on conflict (user_id) do nothing;

  -- 2. grant every default module at its lowest tier -------------------------
  for v_module in
    select id from public.modules where is_default = true
  loop
    select id into v_tier_id
    from public.module_tiers
    where module_id = v_module.id
    order by level asc
    limit 1;

    insert into public.user_modules (user_id, module_id, tier_id, status)
    values (p_user_id, v_module.id, v_tier_id, 'active')
    on conflict (user_id, module_id) do nothing;
  end loop;

  -- 3. the user's first Raket ------------------------------------------------
  select id into v_raket_id
  from public.rakets where user_id = p_user_id
  order by created_at asc limit 1;

  if v_raket_id is null then
    insert into public.rakets (user_id, name, description)
    values (p_user_id, 'My First Raket', 'Your business, one module at a time.')
    returning id into v_raket_id;
  end if;

  -- 4. outer canvas ----------------------------------------------------------
  select id into v_outer_flow_id
  from public.flows where raket_id = v_raket_id and kind = 'raket';

  if v_outer_flow_id is null then
    insert into public.flows (raket_id, user_id, kind, name)
    values (v_raket_id, p_user_id, 'raket', 'Build your Raket')
    returning id into v_outer_flow_id;
  end if;

  -- 5. a "start" marker plus the Booking module node -------------------------
  insert into public.flow_nodes
    (flow_id, user_id, node_key, type, module_id, position_x, position_y, data)
  values
    (v_outer_flow_id, p_user_id, 'start', 'start', null, 40, 24,
     '{"label":"Your business"}'::jsonb)
  on conflict (flow_id, node_key) do nothing;

  insert into public.flow_nodes
    (flow_id, user_id, node_key, type, module_id, position_x, position_y, data)
  values
    (v_outer_flow_id, p_user_id, 'module-booking', 'module', 'booking', 40, 184,
     '{"label":"Booking","tier":"starter"}'::jsonb)
  on conflict (flow_id, node_key) do nothing;

  select id into v_module_node_id
  from public.flow_nodes
  where flow_id = v_outer_flow_id and node_key = 'module-booking';

  insert into public.flow_edges
    (flow_id, user_id, edge_key, source_key, target_key, label)
  values
    (v_outer_flow_id, p_user_id, 'start->module-booking', 'start', 'module-booking', null)
  on conflict (flow_id, edge_key) do nothing;

  -- 6. inner canvas for the Booking module -----------------------------------
  select id into v_inner_flow_id
  from public.flows where parent_node_id = v_module_node_id;

  if v_inner_flow_id is null then
    insert into public.flows (raket_id, user_id, kind, module_id, parent_node_id, name)
    values (v_raket_id, p_user_id, 'module', 'booking', v_module_node_id, 'Booking flow')
    returning id into v_inner_flow_id;
  end if;

  -- 7. pre-wired Booking -> Timer -> Email ------------------------------------
  insert into public.flow_nodes
    (flow_id, user_id, node_key, type, position_x, position_y, data)
  values
    (v_inner_flow_id, p_user_id, 'booking-1', 'booking', 40, 24,
     '{"label":"New booking","service":"Consultation","durationMinutes":30}'::jsonb),
    (v_inner_flow_id, p_user_id, 'timer-1', 'timer', 40, 184,
     '{"label":"Wait","delayValue":1,"delayUnit":"hours"}'::jsonb),
    (v_inner_flow_id, p_user_id, 'email-1', 'email', 40, 344,
     '{"label":"Send confirmation","subject":"Your booking is confirmed","body":"Salamat! We''ve reserved your slot. See you soon."}'::jsonb)
  on conflict (flow_id, node_key) do nothing;

  insert into public.flow_edges
    (flow_id, user_id, edge_key, source_key, target_key, label)
  values
    (v_inner_flow_id, p_user_id, 'booking-1->timer-1', 'booking-1', 'timer-1', null),
    (v_inner_flow_id, p_user_id, 'timer-1->email-1', 'timer-1', 'email-1', null)
  on conflict (flow_id, edge_key) do nothing;
end;
$prov$;

-- --- trigger on auth.users ----------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $hnu$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  perform public.provision_user(new.id);
  return new;
end;
$hnu$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- callable by a signed-in user (repairs an under-provisioned account) -----
create or replace function public.ensure_my_workspace()
returns void
language plpgsql
security definer
set search_path = public
as $ens$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.profiles (id, email)
  select v_uid, u.email from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  perform public.provision_user(v_uid);
end;
$ens$;

grant execute on function public.ensure_my_workspace() to authenticated;
