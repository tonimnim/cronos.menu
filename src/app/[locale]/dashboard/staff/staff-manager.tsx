"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Loader2, UserPlus, Trash2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { normalizePhoneLenient } from "@/lib/auth/phone-client";
import type { CountryCode } from "libphonenumber-js";

type StaffRow = {
  userId: string;
  phone: string | null;
  displayName: string | null;
  role: "owner" | "staff" | "admin";
  createdAt: string;
};

const phoneErrorKey = {
  empty: "phoneEmpty",
  invalid_format: "phoneInvalidFormat",
  invalid_number: "phoneInvalidNumber",
} as const;

export function StaffManager({
  initial,
  currentUserId,
  defaultCountry,
}: {
  initial: StaffRow[];
  currentUserId: string;
  defaultCountry?: CountryCode;
}) {
  const t = useTranslations("dashboard.staff");
  const te = useTranslations("auth.errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [removeErrorFor, setRemoveErrorFor] = useState<Record<string, string>>({});

  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setAddError(null);

    const normalized = normalizePhoneLenient(phone, defaultCountry);
    if (!normalized.ok) {
      setAddError(te(phoneErrorKey[normalized.error]));
      return;
    }
    if (password.length < 8) {
      setAddError(te("passwordTooShort"));
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/auth/signup-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized.value.e164,
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = payload.error ?? "unknown";
        setAddError(te.has(code) ? te(code) : te("unknown"));
        return;
      }
      setPhone("");
      setDisplayName("");
      setPassword("");
      router.refresh();
    });
  }

  async function onRemove(userId: string) {
    if (!confirm(t("confirmRemove"))) return;
    setRemoveErrorFor((prev) => ({ ...prev, [userId]: "" }));
    startTransition(async () => {
      const res = await fetch("/api/auth/remove-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = payload.error ?? "unknown";
        setRemoveErrorFor((prev) => ({
          ...prev,
          [userId]: te.has(code) ? te(code) : te("unknown"),
        }));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section>
        <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/10 bg-background">
          {initial.map((row) => {
            const isSelf = row.userId === currentUserId;
            const isOwner = row.role === "owner";
            return (
              <li
                key={row.userId}
                className="flex items-center gap-3 p-4 md:p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-foreground/5 font-display text-base italic text-foreground">
                  {(row.displayName ?? row.phone ?? "—")
                    .slice(-2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {row.displayName ?? row.phone ?? t("owner")}
                    </span>
                    {isOwner && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 font-tabular text-[9px] uppercase tracking-[0.18em] text-background">
                        <Crown className="size-3" strokeWidth={1.75} />
                        {t("owner")}
                      </span>
                    )}
                    {isSelf && (
                      <span className="font-tabular text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        · {t("you")}
                      </span>
                    )}
                  </div>
                  {row.phone && (
                    <div className="font-tabular text-[11px] text-muted-foreground">
                      {row.phone}
                    </div>
                  )}
                  {removeErrorFor[row.userId] && (
                    <div className="mt-1 font-tabular text-[11px] text-urgent">
                      {removeErrorFor[row.userId]}
                    </div>
                  )}
                </div>
                {!isSelf && !isOwner && (
                  <button
                    type="button"
                    onClick={() => onRemove(row.userId)}
                    disabled={isPending}
                    aria-label={t("remove")}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:border-urgent/50 hover:bg-urgent/10 hover:text-urgent disabled:opacity-50",
                    )}
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-background p-5 md:p-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
            <UserPlus className="size-4" strokeWidth={1.75} />
          </div>
          <h2 className="font-display text-xl italic leading-tight md:text-2xl">
            {t("addTitle")}
          </h2>
        </div>

        <form onSubmit={onAdd} className="mt-5 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="staff-name">{t("nameLabel")}</Label>
            <Input
              id="staff-name"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-phone">{t("phoneLabel")}</Label>
            <Input
              id="staff-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+254 712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-password">{t("passwordLabel")}</Label>
            <Input
              id="staff-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isPending}
              minLength={8}
            />
          </div>

          {addError && (
            <p
              role="alert"
              className="rounded-lg border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm text-urgent"
            >
              {addError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("addSubmit")
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
