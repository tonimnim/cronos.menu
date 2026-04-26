"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Minus, ShoppingCart, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LanguageSwitcher } from "@/components/language-switcher";
import { createClient } from "@/lib/supabase/client";

export type MenuPayload = {
  locale: string;
  restaurant: {
    id: string;
    name: string;
    currency: string;
    defaultLocale: string;
  };
  table: {
    id: string;
    label: string;
  };
  categories: {
    id: string;
    name: string;
    items: {
      id: string;
      name: string;
      description: string;
      price: number;
      imageUrl: string | null;
    }[];
  }[];
};

type CartState = Record<string, number>;

export function CustomerMenu({ payload }: { payload: MenuPayload }) {
  const t = useTranslations("menu");
  const tc = useTranslations("cart");
  const tw = useTranslations("waiter");
  const { locale, restaurant, table, categories } = payload;

  const [cart, setCart] = useState<CartState>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [waiterNote, setWaiterNote] = useState("");
  const [isOrdering, startOrdering] = useTransition();
  const [isCalling, startCalling] = useTransition();

  const itemsById = useMemo(() => {
    const map = new Map<string, { price: number; name: string }>();
    for (const cat of categories) {
      for (const item of cat.items) {
        map.set(item.id, { price: item.price, name: item.name });
      }
    }
    return map;
  }, [categories]);

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartCount = cartEntries.reduce((n, [, qty]) => n + qty, 0);
  const subtotal = cartEntries.reduce((sum, [id, qty]) => {
    const item = itemsById.get(id);
    return sum + (item?.price ?? 0) * qty;
  }, 0);

  function inc(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function dec(id: string) {
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) - 1);
      return { ...c, [id]: next };
    });
  }

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: restaurant.currency,
      }),
    [locale, restaurant.currency],
  );

  async function placeOrder() {
    if (cartEntries.length === 0) return;
    startOrdering(async () => {
      const supabase = createClient();

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurant.id,
          table_id: table.id,
          locale,
          status: "pending",
        })
        .select("id")
        .single();

      if (orderErr || !order) {
        toast.error(t("placeOrderError"));
        return;
      }

      const itemsPayload = cartEntries.map(([id, qty]) => {
        const item = itemsById.get(id)!;
        return {
          order_id: order.id,
          menu_item_id: id,
          quantity: qty,
          unit_price: item.price,
          name_snapshot: item.name,
        };
      });

      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(itemsPayload);

      if (itemsErr) {
        // Rollback: don't leave an empty order on staff's dashboard.
        await supabase.from("orders").delete().eq("id", order.id);
        toast.error(t("placeOrderError"));
        return;
      }

      toast.success(tc("orderPlaced"));
      setCart({});
      setCartOpen(false);
    });
  }

  function sendWaiterRequest(note?: string) {
    startCalling(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("requests").insert({
        restaurant_id: restaurant.id,
        table_id: table.id,
        locale,
        note: note?.trim() || null,
        status: "new",
      });

      if (error) {
        toast.error(t("callWaiterError"));
        return;
      }

      toast.success(tw("sent"));
      setWaiterNote("");
      setWaiterOpen(false);
    });
  }

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-10 px-6 pt-6">
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <Dialog open={waiterOpen} onOpenChange={setWaiterOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2" />
              }
            >
              <Bell className="size-4" />
              {t("callWaiter")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tw("title")}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2">
                {(["bill", "water", "help"] as const).map((preset) => (
                  <Button
                    key={preset}
                    variant="secondary"
                    disabled={isCalling}
                    onClick={() => sendWaiterRequest(tw(`presets.${preset}`))}
                  >
                    {tw(`presets.${preset}`)}
                  </Button>
                ))}
                <Textarea
                  placeholder={tw("reasonPlaceholder")}
                  value={waiterNote}
                  onChange={(e) => setWaiterNote(e.target.value)}
                  className="mt-2"
                  disabled={isCalling}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => sendWaiterRequest(waiterNote)}
                  disabled={isCalling}
                >
                  {isCalling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    tw("send")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {categories.map((category) => (
          <section key={category.id}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              {category.name}
            </h2>
            <div className="grid gap-3">
              {category.items.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <Card key={item.id}>
                    <CardContent className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{item.name}</h3>
                        </div>
                        {item.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        <p className="mt-2 font-medium tabular-nums">
                          {currency.format(item.price)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {qty > 0 ? (
                          <>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => dec(item.id)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-6 text-center tabular-nums">
                              {qty}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => inc(item.id)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => inc(item.id)}>
                            <Plus className="size-4" />
                            <span className="sr-only">{t("addToCart")}</span>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
          <div
            className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 py-3"
            style={{
              paddingBottom:
                "calc(env(safe-area-inset-bottom, 0) + 0.75rem)",
            }}
          >
            <div className="text-sm">
              <div className="text-muted-foreground">{tc("subtotal")}</div>
              <div className="font-semibold tabular-nums">
                {currency.format(subtotal)}
              </div>
            </div>
            <Dialog open={cartOpen} onOpenChange={setCartOpen}>
              <DialogTrigger render={<Button className="gap-2" />}>
                <ShoppingCart className="size-4" />
                {tc("viewCount", { count: cartCount })}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{tc("title")}</DialogTitle>
                </DialogHeader>
                <div className="divide-y">
                  {cartEntries.map(([id, qty]) => {
                    const item = itemsById.get(id);
                    if (!item) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm tabular-nums text-muted-foreground">
                            {qty} × {currency.format(item.price)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => dec(id)}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="w-6 text-center tabular-nums">
                            {qty}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => inc(id)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <DialogFooter>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-muted-foreground">
                      {tc("subtotal")}
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {currency.format(subtotal)}
                    </div>
                  </div>
                  <Button onClick={placeOrder} disabled={isOrdering}>
                    {isOrdering ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      tc("placeOrder")
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </>
  );
}
