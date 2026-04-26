"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "cronmenu:install-dismissed";

export function InstallPrompt() {
  const t = useTranslations("dashboard.install");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(display-mode: standalone)").matches ||
      localStorage.getItem(DISMISS_KEY)
    ) {
      return;
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setHidden(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setHidden(true);
      setDeferred(null);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }

  if (hidden || !deferred) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0)+5rem)] z-30 md:inset-auto md:bottom-6 md:right-6 md:w-[380px]">
      <div className="relative rounded-2xl border border-foreground/10 bg-background/95 p-4 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3 pr-8">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <Download className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base italic leading-tight">
              {t("title")}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("description")}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={install} className="rounded-full">
                {t("install")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                className="rounded-full text-muted-foreground"
              >
                {t("dismiss")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
