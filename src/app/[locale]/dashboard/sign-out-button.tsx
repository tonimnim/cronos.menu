"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => null);
      // Also clear any server-side session cookie (belt + braces).
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={cn(
        "group flex w-full items-center justify-between gap-2 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <LogOut className="size-3.5" strokeWidth={1.75} />
        )}
        {t("signOut")}
      </span>
    </button>
  );
}
