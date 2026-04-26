"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function LivePill({ className }: { className?: string }) {
  const t = useTranslations("dashboard.live");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-tabular text-[10px] uppercase tracking-[0.22em]",
        online ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {online && (
          <span className="absolute inline-flex size-1.5 animate-ping rounded-full bg-foreground/40" />
        )}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            online ? "bg-foreground" : "bg-muted-foreground/60",
          )}
        />
      </span>
      {online ? t("label") : t("offline")}
    </span>
  );
}
