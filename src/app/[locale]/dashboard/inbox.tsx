"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Bell,
  ChefHat,
  Inbox as InboxIcon,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useInbox,
  type InboxOrder,
  type InboxRequest,
} from "@/lib/realtime/use-inbox";
import { createClient } from "@/lib/supabase/client";
import { playChime, tryVibrate } from "@/lib/sound/chime";
import { useSoundPref } from "@/hooks/use-sound-pref";

type Tab = "orders" | "requests";

const DEMO_ORDERS: InboxOrder[] = [
  {
    id: "o1",
    restaurantId: "demo",
    tableLabel: "05",
    status: "pending",
    items: [
      { name: "Grilled Beef", qty: 1, unitPrice: "12.00" },
      { name: "Masala Chai", qty: 2, unitPrice: "2.00" },
    ],
    total: "$16.00",
    note: null,
    createdAt: isoMinsAgo(2),
    minutesAgo: 2,
  },
  {
    id: "o2",
    restaurantId: "demo",
    tableLabel: "03",
    status: "preparing",
    items: [{ name: "Margherita Pizza", qty: 1, unitPrice: "10.00" }],
    total: "$10.00",
    note: null,
    createdAt: isoMinsAgo(8),
    minutesAgo: 8,
  },
  {
    id: "o3",
    restaurantId: "demo",
    tableLabel: "11",
    status: "pending",
    items: [
      { name: "Samosa", qty: 2, unitPrice: "3.50" },
      { name: "Tomato Soup", qty: 1, unitPrice: "4.00" },
    ],
    total: "$11.00",
    note: null,
    createdAt: isoMinsAgo(14),
    minutesAgo: 14,
  },
];

const DEMO_REQUESTS: InboxRequest[] = [
  {
    id: "r1",
    restaurantId: "demo",
    tableLabel: "07",
    note: "Bring the bill",
    status: "new",
    createdAt: isoMinsAgo(1),
    minutesAgo: 1,
  },
  {
    id: "r2",
    restaurantId: "demo",
    tableLabel: "02",
    note: "Water please",
    status: "new",
    createdAt: isoMinsAgo(4),
    minutesAgo: 4,
  },
  {
    id: "r3",
    restaurantId: "demo",
    tableLabel: "09",
    note: "No one has come yet",
    status: "new",
    createdAt: isoMinsAgo(9),
    minutesAgo: 9,
  },
];

function isoMinsAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

export function DashboardInbox({
  restaurantId,
}: {
  restaurantId: string | null;
}) {
  const t = useTranslations("dashboard.inbox");
  const ts = useTranslations("order.status");
  const [tab, setTab] = useState<Tab>("orders");

  const { orders, requests, lastEvent, setOrders, setRequests } = useInbox({
    restaurantId,
    initialOrders: DEMO_ORDERS,
    initialRequests: DEMO_REQUESTS,
  });

  // Sound + haptic feedback on new live events.
  const { enabled: soundOn } = useSoundPref();
  useEffect(() => {
    if (!lastEvent) return;
    if (soundOn) {
      playChime(lastEvent.kind === "order.created" ? "order" : "request");
    }
    tryVibrate([120, 60, 120]);
  }, [lastEvent, soundOn]);

  const advanceOrder = useCallback(
    async (order: InboxOrder) => {
      const next: InboxOrder["status"] =
        order.status === "pending" ? "preparing" : "served";

      setOrders((list) =>
        next === "served"
          ? list.filter((o) => o.id !== order.id)
          : list.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
      );

      if (restaurantId) {
        try {
          const supabase = createClient();
          await supabase
            .from("orders")
            .update({
              status: next,
              ...(next === "served" ? { served_at: new Date().toISOString() } : {}),
            })
            .eq("id", order.id);
        } catch {
          // On failure, the realtime subscription will eventually reconcile.
        }
      }
    },
    [restaurantId, setOrders],
  );

  const resolveRequest = useCallback(
    async (request: InboxRequest) => {
      setRequests((list) => list.filter((r) => r.id !== request.id));
      if (restaurantId) {
        try {
          const supabase = createClient();
          await supabase
            .from("requests")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
            })
            .eq("id", request.id);
        } catch {
          /* reconciled by realtime */
        }
      }
    },
    [restaurantId, setRequests],
  );

  const counts = useMemo(
    () => ({ orders: orders.length, requests: requests.length }),
    [orders.length, requests.length],
  );

  return (
    <section aria-label={t("orders")}>
      <div
        role="tablist"
        aria-label="Inbox filter"
        className="flex w-full items-center gap-1 rounded-full border border-foreground/10 bg-muted/40 p-1 md:w-auto md:self-start"
      >
        {(["orders", "requests"] as const).map((value) => {
          const isActive = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-colors md:flex-none md:px-5",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn(isActive && "font-medium")}>{t(value)}</span>
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-tabular text-[10px] font-semibold",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground",
                )}
              >
                {counts[value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 md:mt-6">
        {tab === "orders" ? (
          orders.length === 0 ? (
            <EmptyState
              title={t("empty")}
              hint={t("emptyHint")}
              icon={<InboxIcon className="size-6" strokeWidth={1.5} />}
            />
          ) : (
            <ol className="grid gap-3 md:grid-cols-2 md:gap-4">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  statusLabel={ts(order.status)}
                  onAdvance={() => advanceOrder(order)}
                  advanceLabel={
                    order.status === "pending"
                      ? t("markPreparing")
                      : t("markServed")
                  }
                  timeLabel={
                    order.minutesAgo <= 0
                      ? t("justNow")
                      : t("minAgo", { count: order.minutesAgo })
                  }
                />
              ))}
            </ol>
          )
        ) : requests.length === 0 ? (
          <EmptyState
            title={t("empty")}
            hint={t("emptyHint")}
            icon={<Bell className="size-6" strokeWidth={1.5} />}
          />
        ) : (
          <ol className="grid gap-3 md:grid-cols-2 md:gap-4">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onResolve={() => resolveRequest(req)}
                resolveLabel={t("resolve")}
                timeLabel={
                  req.minutesAgo <= 0
                    ? t("justNow")
                    : t("minAgo", { count: req.minutesAgo })
                }
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function urgencyFor(
  minutes: number,
  thresholds: [number, number],
): "calm" | "warm" | "hot" {
  if (minutes >= thresholds[1]) return "hot";
  if (minutes >= thresholds[0]) return "warm";
  return "calm";
}

function OrderCard({
  order,
  statusLabel,
  onAdvance,
  advanceLabel,
  timeLabel,
}: {
  order: InboxOrder;
  statusLabel: string;
  onAdvance: () => void;
  advanceLabel: string;
  timeLabel: string;
}) {
  const urgency = urgencyFor(order.minutesAgo, [5, 12]);

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-background transition-all",
        urgency === "hot" && "border-urgent shadow-[0_0_0_1px_var(--urgent)]",
        urgency === "warm" && "border-warn/60",
        urgency === "calm" && "border-foreground/10 hover:border-foreground/25",
      )}
    >
      <div className="flex gap-4 p-4 md:p-5">
        <div className="flex shrink-0 flex-col items-center justify-center border-r border-foreground/10 pr-4 md:pr-5">
          <div className="font-tabular text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Table
          </div>
          <div className="font-display text-5xl italic leading-none tracking-tight md:text-6xl">
            {order.tableLabel}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-tabular text-[10px] uppercase tracking-[0.18em]",
                  order.status === "pending"
                    ? "bg-foreground text-background"
                    : "border border-foreground/20 text-foreground",
                )}
              >
                {order.status === "preparing" && <ChefHat className="size-3" />}
                {statusLabel}
              </span>
              <UrgencyDot urgency={urgency} />
            </div>
            <span
              className={cn(
                "shrink-0 font-tabular text-[10px] uppercase tracking-[0.18em]",
                urgency === "hot"
                  ? "font-semibold text-urgent"
                  : urgency === "warm"
                    ? "font-medium text-warn"
                    : "text-muted-foreground",
              )}
            >
              {timeLabel}
            </span>
          </div>

          <ul className="mt-2.5 space-y-0.5 font-tabular text-[13px] leading-relaxed">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  <span className="tabular-nums text-muted-foreground">
                    {it.qty}×
                  </span>{" "}
                  {it.name}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-foreground/15 pt-3">
            <span className="font-tabular text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Total <span className="ml-2 text-foreground">{order.total}</span>
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdvance}
        className={cn(
          "group/btn flex w-full items-center justify-between gap-2 border-t border-foreground/10 px-4 py-3.5 text-sm font-medium transition-colors md:py-3",
          urgency === "hot"
            ? "bg-urgent text-white hover:bg-urgent/90"
            : "bg-muted/30 text-foreground hover:bg-foreground hover:text-background",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Check className="size-4" strokeWidth={2} />
          {advanceLabel}
        </span>
        <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
      </button>
    </li>
  );
}

function RequestCard({
  request,
  onResolve,
  resolveLabel,
  timeLabel,
}: {
  request: InboxRequest;
  onResolve: () => void;
  resolveLabel: string;
  timeLabel: string;
}) {
  const urgency = urgencyFor(request.minutesAgo, [3, 7]);

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-background transition-all",
        urgency === "hot" && "border-urgent shadow-[0_0_0_1px_var(--urgent)]",
        urgency === "warm" && "border-warn/60",
        urgency === "calm" && "border-foreground/10 hover:border-foreground/25",
      )}
    >
      <div className="flex gap-4 p-4 md:p-5">
        <div className="flex shrink-0 flex-col items-center justify-center border-r border-foreground/10 pr-4 md:pr-5">
          <div className="font-tabular text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Table
          </div>
          <div className="font-display text-5xl italic leading-none tracking-tight md:text-6xl">
            {request.tableLabel}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-background",
                  urgency === "hot" ? "bg-urgent" : "bg-foreground",
                )}
              >
                <Bell className="size-3.5" />
              </div>
              <UrgencyDot urgency={urgency} />
            </div>
            <span
              className={cn(
                "shrink-0 font-tabular text-[10px] uppercase tracking-[0.18em]",
                urgency === "hot"
                  ? "font-semibold text-urgent"
                  : urgency === "warm"
                    ? "font-medium text-warn"
                    : "text-muted-foreground",
              )}
            >
              {timeLabel}
            </span>
          </div>

          <p className="mt-3 font-display text-xl italic leading-tight md:text-2xl">
            &ldquo;{request.note ?? "—"}&rdquo;
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onResolve}
        className={cn(
          "group/btn flex w-full items-center justify-between gap-2 border-t border-foreground/10 px-4 py-3.5 text-sm font-medium transition-colors md:py-3",
          urgency === "hot"
            ? "bg-urgent text-white hover:bg-urgent/90"
            : "bg-muted/30 text-foreground hover:bg-foreground hover:text-background",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Check className="size-4" strokeWidth={2} />
          {resolveLabel}
        </span>
        <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
      </button>
    </li>
  );
}

function UrgencyDot({ urgency }: { urgency: "calm" | "warm" | "hot" }) {
  if (urgency === "calm") return null;
  const isHot = urgency === "hot";
  return (
    <span
      className="relative inline-flex size-2"
      aria-label={isHot ? "Urgent" : "Needs attention"}
    >
      <span
        className={cn(
          "absolute inline-flex size-2 rounded-full",
          isHot ? "animate-ping bg-urgent/60" : "bg-warn/50",
        )}
      />
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          isHot ? "bg-urgent" : "bg-warn",
        )}
      />
    </span>
  );
}

function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/15 bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-foreground/10 bg-background text-muted-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-2xl italic leading-tight md:text-3xl">
        {title}
      </h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
