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
