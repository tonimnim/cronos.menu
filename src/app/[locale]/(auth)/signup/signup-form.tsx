"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const te = useTranslations("auth.errors");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const businessNameTrimmed = businessName.trim();
    if (businessNameTrimmed.length < 2) {
      setError(te("restaurantTooShort"));
      return;
    }
    // Most common signup-trap: users paste their email into the restaurant
    // name field. The slug derived from that becomes the public QR URL,
    // which is permanent (printed stickers) and leaks the email via
    // sitemap/SEO. Catch it here and surface a clear error.
    if (businessNameTrimmed.includes("@")) {
      setError(te("restaurant_looks_like_email"));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(te("emailInvalid"));
      return;
    }
    if (password.length < 8) {
      setError(te("passwordTooShort"));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const redirect = new URL(
        `/${locale}/auth/callback`,
        window.location.origin,
      );
      redirect.searchParams.set("next", `/${locale}/dashboard`);

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirect.toString(),
          data: {
            business_name: businessName.trim(),
          },
        },
      });

      if (signUpErr || !data?.user) {
        const msg = signUpErr?.message?.toLowerCase() ?? "";
        const code = msg.includes("already") || msg.includes("registered")
          ? "email_already_registered"
          : "auth_create_failed";
        setError(te.has(code) ? te(code) : te("unknown"));
        return;
      }

      const res = await fetch("/api/auth/signup-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.user.id,
          businessName: businessName.trim(),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const code: string = payload.error ?? "unknown";
        setError(te.has(code) ? te(code) : te("unknown"));
        return;
      }

      // If session exists immediately (email confirmation disabled in Supabase),
      // skip straight to the dashboard. Otherwise, show the "check inbox" screen.
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        router.replace(
          `/signup/confirm?email=${encodeURIComponent(email.trim())}`,
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="business">{t("businessNameLabel")}</Label>
        <Input
          id="business"
          autoComplete="organization"
          placeholder={t("businessNamePlaceholder")}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          disabled={isPending}
          maxLength={80}
        />
        <p className="text-xs text-muted-foreground">
          {t("businessNameHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("passwordLabel")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
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
