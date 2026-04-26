"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { phoneToSyntheticEmail } from "@/lib/auth/phone";
import { normalizePhoneLenient } from "@/lib/auth/phone-client";
import type { CountryCode } from "libphonenumber-js";

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function LoginForm({
  defaultCountry,
}: {
  defaultCountry?: CountryCode;
}) {
  const t = useTranslations("auth.login");
  const te = useTranslations("auth.errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(te("passwordTooShort"));
      return;
    }

    // Auto-detect: "@" in the input → real email; otherwise → phone, which
    // we normalize and map to its synthetic-email shadow.
    let email: string;
    if (looksLikeEmail(identifier)) {
      email = identifier.trim();
    } else {
      const normalized = normalizePhoneLenient(identifier, defaultCountry);
      if (!normalized.ok) {
        setError(te("identifierInvalid"));
        return;
      }
      email = phoneToSyntheticEmail(normalized.value.e164);
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) {
        setError(te("invalidCredentials"));
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">{t("identifierLabel")}</Label>
        <Input
          id="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder={t("identifierPlaceholder")}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">{t("identifierHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("passwordLabel")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          minLength={8}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm text-urgent"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="group w-full rounded-full"
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            {t("submit")}
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}
