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
