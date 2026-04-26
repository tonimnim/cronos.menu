import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tc = await getTranslations("common");
  const t = await getTranslations("admin");

  // TODO: gate behind Supabase auth with role=admin.

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            {tc("appName")}
          </Link>
          <span className="text-sm text-muted-foreground">{t("title")}</span>
        </div>
        <LanguageSwitcher />
      </header>
      {children}
    </div>
  );
}
