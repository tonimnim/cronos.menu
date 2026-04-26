/**
 * notify-on-event — Supabase Edge Function
 *
 * Triggered by a Postgres webhook (see supabase/migrations/push_trigger.sql)
 * whenever a row is inserted into `orders` or `requests`. Looks up every
 * push subscription bound to that restaurant and sends a Web Push payload.
 *
 * Expired / invalid subscriptions (HTTP 404 / 410) are pruned automatically;
 * other failures bump `failure_count` and are pruned after 5 consecutive
 * failures.
 *
 * Deploy:
 *   supabase functions deploy notify-on-event --no-verify-jwt
 *   supabase secrets set \
 *     VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_CONTACT=mailto:you@x.com
 */

// deno-lint-ignore-file
// @ts-nocheck  (Deno runtime; not typechecked by the Next.js project's tsc)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE =
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_CONTACT = Deno.env.get("VAPID_CONTACT") ?? "mailto:support@cron.menu";

webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);

type OrderRow = {
  id: string;
  restaurant_id: string;
  table_id: string;
  status: string;
  note: string | null;
};

type RequestRow = {
  id: string;
  restaurant_id: string;
  table_id: string;
  note: string | null;
};

type Payload = {
  type: "order" | "request";
  record: OrderRow | RequestRow;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: tableRow } = await admin
    .from("tables")
    .select("label")
    .eq("id", body.record.table_id)
    .maybeSingle();
  const tableLabel = tableRow?.label ?? "?";

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("restaurant_id", body.record.restaurant_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_subscribers" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const payload = JSON.stringify(
    body.type === "order"
      ? {
          title: `New order · Table ${tableLabel}`,
          body: body.record.note ?? "Tap to view the ticket.",
          tag: `order-${body.record.id}`,
          url: "/dashboard",
          requireInteraction: true,
        }
      : {
          title: `Table ${tableLabel} needs a waiter`,
          body: body.record.note ?? "Tap to view.",
          tag: `request-${body.record.id}`,
          url: "/dashboard",
          requireInteraction: true,
        },
  );

  // Web Push options: TTL 60s (old alerts aren't useful); High urgency so
  // the push service delivers fast rather than batching.
  const options = { TTL: 60, urgency: "high" as const };

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        payload,
        options,
      ),
    ),
  );

  // Housekeep: prune gone subscriptions, bump failure counters on transient errors.
  const toDelete: string[] = [];
  const toBump: string[] = [];
  results.forEach((r, i) => {
    const s = subs[i];
    if (r.status === "rejected") {
      const code = (r.reason as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) toDelete.push(s.id);
      else toBump.push(s.id);
    }
  });

  if (toDelete.length) {
    await admin.from("push_subscriptions").delete().in("id", toDelete);
  }
  if (toBump.length) {
    for (const id of toBump) {
      // rpc avoids a round-trip; but since we don't have one defined,
      // do a simple update that will also prune after 5 failures.
      const { data: cur } = await admin
        .from("push_subscriptions")
        .select("failure_count")
        .eq("id", id)
        .maybeSingle();
      const next = (cur?.failure_count ?? 0) + 1;
      if (next >= 5) {
        await admin.from("push_subscriptions").delete().eq("id", id);
      } else {
        await admin
          .from("push_subscriptions")
          .update({ failure_count: next })
          .eq("id", id);
      }
    }
  }

  return new Response(
    JSON.stringify({
      attempted: subs.length,
      pruned: toDelete.length,
      failures: toBump.length,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
