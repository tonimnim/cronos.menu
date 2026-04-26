"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type OrderStatus = "pending" | "preparing" | "served" | "cancelled";
export type RequestStatus = "new" | "acknowledged" | "resolved";

export type InboxOrder = {
  id: string;
  restaurantId: string;
  tableLabel: string;
  status: OrderStatus;
  items: { name: string; qty: number; unitPrice: string }[];
  total: string;
  note: string | null;
  createdAt: string;
  minutesAgo: number;
};

export type InboxRequest = {
  id: string;
  restaurantId: string;
  tableLabel: string;
  note: string | null;
  status: RequestStatus;
  createdAt: string;
  minutesAgo: number;
};

export type Connection =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline"
  | "error";

export type InboxEvent =
  | { kind: "order.created"; order: InboxOrder; at: number }
  | { kind: "request.created"; request: InboxRequest; at: number };

type Opts = {
  restaurantId: string | null;
  initialOrders: InboxOrder[];
  initialRequests: InboxRequest[];
};

/**
 * Live inbox for a single restaurant.
 *
 * Behaviour:
 *  - If `restaurantId` is null OR Supabase env vars are missing, it stays on
 *    the provided initial snapshot and reports `connection: "offline"`.
 *  - Otherwise it subscribes to Postgres Changes on `orders` + `requests`
 *    filtered by restaurant_id, applies INSERT/UPDATE/DELETE, and keeps
 *    `minutesAgo` fresh on a 30s tick.
 *  - Emits `lastEvent` so parent components can react (sound, vibration,
 *    toast) without owning subscription state.
 */
export function useInbox({ restaurantId, initialOrders, initialRequests }: Opts) {
  const [orders, setOrders] = useState<InboxOrder[]>(initialOrders);
  const [requests, setRequests] = useState<InboxRequest[]>(initialRequests);
  const [connection, setConnection] = useState<Connection>("idle");
  const [lastEvent, setLastEvent] = useState<InboxEvent | null>(null);
  const mountedRef = useRef(false);

  // Keep minutesAgo fresh — derive from createdAt every 30s.
  useEffect(() => {
    const tick = () => {
      setOrders((list) =>
        list.map((o) => ({ ...o, minutesAgo: minutesSince(o.createdAt) })),
      );
      setRequests((list) =>
        list.map((r) => ({ ...r, minutesAgo: minutesSince(r.createdAt) })),
      );
    };
    const h = window.setInterval(tick, 30_000);
    return () => window.clearInterval(h);
  }, []);

  useEffect(() => {
    const hasSupabase =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
    if (!restaurantId || !hasSupabase) {
      setConnection("offline");
      return;
    }

    mountedRef.current = true;
    setConnection("connecting");
    const supabase = createClient();

    // Hydrate snapshot (authoritative, overrides initial mocks)
    void (async () => {
      try {
        const [{ data: orderRows }, { data: reqRows }] = await Promise.all([
          supabase
            .from("orders")
            .select("id, restaurant_id, status, note, created_at, tables(label), order_items(quantity, unit_price, name_snapshot)")
            .eq("restaurant_id", restaurantId)
            .in("status", ["pending", "preparing"])
            .order("created_at", { ascending: true }),
          supabase
            .from("requests")
            .select("id, restaurant_id, status, note, created_at, tables(label)")
            .eq("restaurant_id", restaurantId)
            .in("status", ["new", "acknowledged"])
            .order("created_at", { ascending: true }),
        ]);

        if (!mountedRef.current) return;
        if (orderRows) setOrders((orderRows as unknown as OrderRow[]).map(toInboxOrder));
        if (reqRows) setRequests((reqRows as unknown as RequestRow[]).map(toInboxRequest));
      } catch {
        if (mountedRef.current) setConnection("error");
      }
    })();

    const channel = supabase
      .channel(`inbox:${restaurantId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          handleOrderChange(payload, setOrders, setLastEvent);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          handleRequestChange(payload, setRequests, setLastEvent);
        },
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setConnection("reconnecting");
        else if (status === "CLOSED") setConnection("offline");
      });

    return () => {
      mountedRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return { orders, requests, connection, lastEvent, setOrders, setRequests };
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

type OrderRow = {
  id: string;
  restaurant_id: string;
  status: OrderStatus;
  note: string | null;
  created_at: string;
  // Supabase joins can arrive as either a single object or a one-element array
  // depending on how the client infers cardinality; handle both shapes.
  tables: { label: string } | { label: string }[] | null;
  order_items:
    | { quantity: number; unit_price: string; name_snapshot: string }[]
    | null;
};

type RequestRow = {
  id: string;
  restaurant_id: string;
  status: RequestStatus;
  note: string | null;
  created_at: string;
  tables: { label: string } | { label: string }[] | null;
};

function readTableLabel(
  tables: { label: string } | { label: string }[] | null,
): string {
  if (!tables) return "?";
  if (Array.isArray(tables)) return tables[0]?.label ?? "?";
  return tables.label ?? "?";
}

function toInboxOrder(row: OrderRow): InboxOrder {
  const items = (row.order_items ?? []).map((it) => ({
    name: it.name_snapshot,
    qty: it.quantity,
    unitPrice: it.unit_price,
  }));
  const total = items
    .reduce((n, it) => n + Number(it.unitPrice) * it.qty, 0)
    .toFixed(2);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tableLabel: readTableLabel(row.tables),
    status: row.status,
    items,
    total: `$${total}`,
    note: row.note,
    createdAt: row.created_at,
    minutesAgo: minutesSince(row.created_at),
  };
}

function toInboxRequest(row: RequestRow): InboxRequest {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tableLabel: readTableLabel(row.tables),
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    minutesAgo: minutesSince(row.created_at),
  };
}

function handleOrderChange(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  setOrders: React.Dispatch<React.SetStateAction<InboxOrder[]>>,
  setLastEvent: (e: InboxEvent) => void,
) {
  const row = (payload.new ?? payload.old) as OrderRow | null;
  if (!row) return;

  if (payload.eventType === "DELETE") {
    setOrders((list) => list.filter((o) => o.id !== row.id));
    return;
  }
  if (payload.eventType === "UPDATE") {
    if (row.status === "served" || row.status === "cancelled") {
      setOrders((list) => list.filter((o) => o.id !== row.id));
    } else {
      setOrders((list) =>
        list.map((o) => (o.id === row.id ? toInboxOrder(row) : o)),
      );
    }
    return;
  }
  // INSERT
  if (row.status === "pending" || row.status === "preparing") {
    const order = toInboxOrder(row);
    setOrders((list) => [...list, order]);
    setLastEvent({ kind: "order.created", order, at: Date.now() });
  }
}

function handleRequestChange(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  setRequests: React.Dispatch<React.SetStateAction<InboxRequest[]>>,
  setLastEvent: (e: InboxEvent) => void,
) {
  const row = (payload.new ?? payload.old) as RequestRow | null;
  if (!row) return;

  if (payload.eventType === "DELETE") {
    setRequests((list) => list.filter((r) => r.id !== row.id));
    return;
  }
  if (payload.eventType === "UPDATE") {
    if (row.status === "resolved") {
      setRequests((list) => list.filter((r) => r.id !== row.id));
    } else {
      setRequests((list) =>
        list.map((r) => (r.id === row.id ? toInboxRequest(row) : r)),
      );
    }
    return;
  }
  // INSERT
  if (row.status !== "resolved") {
    const request = toInboxRequest(row);
    setRequests((list) => [...list, request]);
    setLastEvent({ kind: "request.created", request, at: Date.now() });
  }
}
