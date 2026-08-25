-- =============================================================================
-- RaketShip — Website, the business's own front door
-- =============================================================================
-- The second add-on module, cut from the Client Manager's pattern: a catalog
-- row and a switch, no tables of its own, switched on from My raket parts
-- without spending a plan slot. On the board it wires FROM the business —
-- the start node — because a website is the business showing itself, not a
-- step in the booking flow.
--
-- The module's page is deliberately empty for now: the row exists so the
-- part can be placed, named and wired while what it serves is being built.
-- =============================================================================

insert into public.modules
  (id, name, tagline, description, icon, category, accent, is_default, is_available, sort_order)
values
  ('website', 'Website', 'Ang sariling page ng negosyo mo',
   'A simple website for your business, on your own link. Malapit na.',
   'Globe', 'sales', 'chart-5', false, true, 3)
on conflict (id) do nothing;

insert into public.module_tiers
  (module_id, key, name, description, price_centavos, level, features, node_types)
values
  ('website', 'starter', 'Starter',
   'Isang page, sariling link.', 0, 1,
   '["One page for your business","Your own link","Malapit na"]'::jsonb,
   '[]'::jsonb)
on conflict do nothing;
