import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.confirm");
  const { email } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href={`/${locale}`} className="group flex items-baseline gap-0.5">
        <span className="text-base font-semibold tracking-tighter">cron</span>
        <span className="font-display text-xl italic tracking-tight text-foreground/80 transition-colors group-hover:text-foreground">
          .menu
        </span>
      </Link>

      <div className="mt-10">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-foreground text-background">
          <MailCheck className="size-5" strokeWidth={1.75} />
        </div>
        <div className="mt-5 font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("kicker")}
        </div>
        <h1 className="mt-2 font-display text-5xl italic leading-[0.95] tracking-tight">
          {t("title")}
        </h1>
        {email && (
          <p className="mt-4 font-tabular text-sm">
            <span className="text-muted-foreground">{t("sentTo")}</span>{" "}
            <span className="font-medium">{email}</span>
          </p>
        )}
        <p className="mt-4 max-w-sm text-sm text-muted-foreground">
          {t("body")}
        </p>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        {t("didntArrive")}{" "}
        <Link
          href={`/${locale}/login`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
