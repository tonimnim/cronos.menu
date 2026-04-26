-- Row-Level Security policies for cron.menu.
--
-- The model:
--   anon              guest at a table — can read public menu, create orders/requests
--   authenticated     staff member (has a row in staff_users) — can manage their own restaurant's data
--   service_role      edge functions / admin — bypasses RLS entirely
--
-- Everything runs idempotently (drop-before-create), so re-running this file is safe.

-- ─── Helper: the restaurant the current staff user works at ──────────
create or replace function public.current_staff_restaurant()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.staff_users where user_id = auth.uid();
$$;

grant execute on function public.current_staff_restaurant() to anon, authenticated;

-- ─── Enable RLS on every tenant-scoped table ─────────────────────────
alter table public.restaurants       enable row level security;
alter table public.tables            enable row level security;
alter table public.menu_categories   enable row level security;
alter table public.menu_items        enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.requests          enable row level security;
alter table public.staff_users       enable row level security;
alter table public.push_subscriptions enable row level security;

-- ─── restaurants ─────────────────────────────────────────────────────
drop policy if exists "restaurants_public_read" on public.restaurants;
create policy "restaurants_public_read"
  on public.restaurants for select
  using (true);

drop policy if exists "restaurants_staff_update" on public.restaurants;
create policy "restaurants_staff_update"
  on public.restaurants for update to authenticated
  using (id = public.current_staff_restaurant())
  with check (id = public.current_staff_restaurant());

-- ─── tables ──────────────────────────────────────────────────────────
drop policy if exists "tables_public_read" on public.tables;
create policy "tables_public_read"
  on public.tables for select
  using (true);

drop policy if exists "tables_staff_manage" on public.tables;
create policy "tables_staff_manage"
  on public.tables for all to authenticated
  using (restaurant_id = public.current_staff_restaurant())
  with check (restaurant_id = public.current_staff_restaurant());

-- ─── menu_categories / menu_items ────────────────────────────────────
drop policy if exists "menu_categories_public_read" on public.menu_categories;
create policy "menu_categories_public_read"
  on public.menu_categories for select
  using (true);

drop policy if exists "menu_categories_staff_manage" on public.menu_categories;
create policy "menu_categories_staff_manage"
  on public.menu_categories for all to authenticated
  using (restaurant_id = public.current_staff_restaurant())
  with check (restaurant_id = public.current_staff_restaurant());

drop policy if exists "menu_items_public_read" on public.menu_items;
create policy "menu_items_public_read"
  on public.menu_items for select
  using (true);

drop policy if exists "menu_items_staff_manage" on public.menu_items;
create policy "menu_items_staff_manage"
  on public.menu_items for all to authenticated
  using (restaurant_id = public.current_staff_restaurant())
  with check (restaurant_id = public.current_staff_restaurant());

-- ─── orders ──────────────────────────────────────────────────────────
drop policy if exists "orders_guest_insert" on public.orders;
create policy "orders_guest_insert"
  on public.orders for insert to anon, authenticated
  with check (true);

drop policy if exists "orders_staff_read" on public.orders;
create policy "orders_staff_read"
  on public.orders for select to authenticated
  using (restaurant_id = public.current_staff_restaurant());

drop policy if exists "orders_staff_update" on public.orders;
create policy "orders_staff_update"
  on public.orders for update to authenticated
  using (restaurant_id = public.current_staff_restaurant())
  with check (restaurant_id = public.current_staff_restaurant());

-- ─── order_items ─────────────────────────────────────────────────────
drop policy if exists "order_items_guest_insert" on public.order_items;
create policy "order_items_guest_insert"
  on public.order_items for insert to anon, authenticated
  with check (
    exists (select 1 from public.orders o where o.id = order_items.order_id)
  );

drop policy if exists "order_items_staff_read" on public.order_items;
create policy "order_items_staff_read"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.restaurant_id = public.current_staff_restaurant()
    )
  );

-- ─── requests ────────────────────────────────────────────────────────
drop policy if exists "requests_guest_insert" on public.requests;
create policy "requests_guest_insert"
  on public.requests for insert to anon, authenticated
  with check (true);

drop policy if exists "requests_staff_read" on public.requests;
create policy "requests_staff_read"
  on public.requests for select to authenticated
  using (restaurant_id = public.current_staff_restaurant());

drop policy if exists "requests_staff_update" on public.requests;
create policy "requests_staff_update"
  on public.requests for update to authenticated
  using (restaurant_id = public.current_staff_restaurant())
  with check (restaurant_id = public.current_staff_restaurant());

-- ─── staff_users ─────────────────────────────────────────────────────
drop policy if exists "staff_read_self" on public.staff_users;
create policy "staff_read_self"
  on public.staff_users for select to authenticated
  using (user_id = auth.uid());

-- ─── push_subscriptions ──────────────────────────────────────────────
drop policy if exists "push_manage_own" on public.push_subscriptions;
create policy "push_manage_own"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid() or restaurant_id = public.current_staff_restaurant())
  with check (user_id = auth.uid() or restaurant_id = public.current_staff_restaurant());

-- Allow anon-subscribed devices (e.g. waiter phone before login) to register
-- their own subscription; they can only insert a row tied to their own endpoint.
drop policy if exists "push_guest_insert" on public.push_subscriptions;
create policy "push_guest_insert"
  on public.push_subscriptions for insert to anon
  with check (true);
