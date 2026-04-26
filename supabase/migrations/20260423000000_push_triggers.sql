-- Fire the `notify-on-event` Edge Function whenever a new order or request
-- is inserted. Requires the `pg_net` extension (Supabase enables this by
-- default in new projects; run `create extension if not exists pg_net;` if
-- it isn't already there).
--
-- Two project-level settings control where the function lives and which
-- credential is used. Set them once per environment:
--
--   alter database postgres set app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
--   alter database postgres set app.edge_function_key = '<service-role-jwt-or-anon-with-invoke-perms>';
--
-- Keep the key in Supabase dashboard → Settings → Vault rather than
-- checking it into source control.

create or replace function public.notify_on_order_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url text := current_setting('app.edge_function_url', true);
  edge_key text := current_setting('app.edge_function_key', true);
begin
  if edge_url is null then
    return new;
  end if;
  perform net.http_post(
    url      := edge_url || '/notify-on-event',
    headers  := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ' || coalesce(edge_key, '')
                ),
    body     := jsonb_build_object(
                  'type', 'order',
                  'record', to_jsonb(new)
                ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create or replace function public.notify_on_request_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url text := current_setting('app.edge_function_url', true);
  edge_key text := current_setting('app.edge_function_key', true);
begin
  if edge_url is null then
    return new;
  end if;
  perform net.http_post(
    url      := edge_url || '/notify-on-event',
    headers  := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ' || coalesce(edge_key, '')
                ),
    body     := jsonb_build_object(
                  'type', 'request',
                  'record', to_jsonb(new)
                ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists on_order_insert_notify on public.orders;
create trigger on_order_insert_notify
  after insert on public.orders
  for each row execute function public.notify_on_order_insert();

drop trigger if exists on_request_insert_notify on public.requests;
create trigger on_request_insert_notify
  after insert on public.requests
  for each row execute function public.notify_on_request_insert();

-- Supabase Realtime: ensure the tables we subscribe to from the dashboard
-- are in the publication. No-op if already added.
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.requests;
alter publication supabase_realtime add table public.order_items;
