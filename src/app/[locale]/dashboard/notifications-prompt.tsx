"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isPushDismissed,
  markPushDismissed,
  notificationPermission,
  pushSupport,
  subscribeToPush,
} from "@/lib/push/client";

type Props = {
  restaurantId: string | null;
};

type State = "hidden" | "visible" | "subscribing" | "subscribed" | "blocked";

export function NotificationsPrompt({ restaurantId }: Props) {
  const t = useTranslations("dashboard.notifications");
  const [state, setState] = useState<State>("hidden");

  useEffect(() => {
    if (!pushSupport().supported) return;
    if (isPushDismissed()) return;
    const perm = notificationPermission();
    if (perm === "granted") {
      setState("subscribed");
      return;
    }
    if (perm === "denied") {
      setState("blocked");
      return;
    }
    setState("visible");
  }, []);

  const onEnable = useCallback(async () => {
    if (!restaurantId) return;
    setState("subscribing");
    try {
      const sub = await subscribeToPush({ restaurantId });
      if (sub) {
        setState("subscribed");
      } else {
        const perm = notificationPermission();
        setState(perm === "denied" ? "blocked" : "hidden");
        markPushDismissed();
      }
    } catch {
      setState("visible");
    }
  }, [restaurantId]);

  const onDismiss = useCallback(() => {
    markPushDismissed();
    setState("hidden");
  }, []);

  if (state === "hidden" || state === "subscribed") return null;

  return (
    <div
      role="region"
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-background px-4 py-4 shadow-sm md:px-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
          <Bell className="size-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base italic leading-tight md:text-lg">
            {state === "blocked" ? t("blockedTitle") : t("title")}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
            {state === "blocked" ? t("blockedDescription") : t("description")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {state !== "blocked" && (
              <Button
                size="sm"
                onClick={onEnable}
                disabled={state === "subscribing" || !restaurantId}
                className="rounded-full"
              >
                {state === "subscribing" ? t("enabling") : t("enable")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="rounded-full text-muted-foreground"
            >
              {t("dismiss")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("dismiss")}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
