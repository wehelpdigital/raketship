-- =============================================================================
-- RaketShip — Client Manager, the module that catches what Booking brings in
-- =============================================================================
-- A basic CRM: everyone who ever booked, with everything they submitted. It
-- OWNS NO TABLES — the bookings rows already hold every fact a client has
-- given, and a second copy would drift from the first the day a booking was
-- cancelled in one place and not the other. The module is a way of READING
-- bookings, so activating it is a catalog row and a switch, nothing more.
--
-- It is switched on from Booking's "What's next" tab rather than bought in
-- the marketplace, and does not spend a plan's module slot: it is what
-- happens AFTER a booking, not a separate raket.
-- =============================================================================

insert into public.modules
  (id, name, tagline, description, icon, category, accent, is_default, is_available, sort_order)
values
  ('client-manager', 'Client Manager', 'Lahat ng suki mo, sa isang lista',
   'Everyone who booked, with their contact details and every answer they gave — gathered from your bookings automatically.',
   'UserCheck', 'sales', 'chart-4', false, true, 2)
on conflict (id) do nothing;

insert into public.module_tiers
  (module_id, key, name, description, price_centavos, level, features, node_types)
values
  ('client-manager', 'starter', 'Starter',
   'Every client, every answer, searchable.', 0, 1,
   '["All clients from your bookings","Their answers to your forms","Search and filter"]'::jsonb,
   '[]'::jsonb)
on conflict do nothing;
