import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.signup");

  const me = await getCurrentStaff();
  if (me) redirect(`/${locale}/dashboard`);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href={`/${locale}`} className="group flex items-baseline gap-0.5">
        <span className="text-base font-semibold tracking-tighter">cron</span>
        <span className="font-display text-xl italic tracking-tight text-foreground/80 transition-colors group-hover:text-foreground">
          .menu
        </span>
      </Link>

      <div className="mt-10">
        <div className="font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {t("kicker")}
        </div>
        <h1 className="mt-2 font-display text-5xl italic leading-[0.95] tracking-tight">
          {t("title")}
        </h1>
      </div>

      <SignupForm />

      <p className="mt-8 text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
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
