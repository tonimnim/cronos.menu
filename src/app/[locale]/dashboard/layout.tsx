import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LivePill } from "./live-pill";
import { NavLink, type NavIconKey } from "./nav-link";
import { InstallPrompt } from "./install-prompt";
import { SoundToggle } from "./sound-toggle";
import { SignOutButton } from "./sign-out-button";
import { getCurrentStaff } from "@/lib/auth/current-user";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const me = await getCurrentStaff();
  if (!me) {
    redirect(`/${locale}/login`);
  }

  const isOwner = me.role === "owner" || me.role === "admin";

  const nav: {
    href: string;
    label: string;
    iconKey: NavIconKey;
    badge?: number;
  }[] = [
    { href: "/dashboard", label: t("nav.inbox"), iconKey: "inbox" },
    { href: "/dashboard/menu", label: t("nav.menu"), iconKey: "menu" },
    { href: "/dashboard/tables", label: t("nav.tables"), iconKey: "tables" },
    ...(isOwner
      ? [
          {
            href: "/dashboard/staff",
            label: t("nav.staff"),
            iconKey: "staff" as NavIconKey,
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-[100dvh] flex-1">
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-foreground/10 bg-muted/30 md:flex">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <Link href="/" className="group flex items-baseline gap-0.5">
            <span className="text-base font-semibold tracking-tighter">cron</span>
            <span className="font-display text-xl italic tracking-tight text-foreground/80 transition-colors group-hover:text-foreground">
              .menu
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <LivePill />
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              iconKey={item.iconKey}
              variant="sidebar"
              badge={item.badge}
            />
          ))}
        </nav>
        <div className="space-y-3 border-t border-foreground/10 p-3">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-background/50 px-3 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium">
                {me.restaurantName}
              </span>
              <span className="truncate font-tabular text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {me.displayName ?? me.phone ?? me.email ?? me.role} · {me.role}
              </span>
            </div>
            <LanguageSwitcher />
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="pwa-locked top-0 inset-x-0 z-30 flex items-center justify-between gap-3 border-b border-foreground/10 bg-background/85 px-4 pt-[calc(env(safe-area-inset-top,0)+0.75rem)] pb-3 backdrop-blur-xl md:hidden"
        >
          <Link href="/" className="flex items-baseline gap-0.5">
            <span className="text-base font-semibold tracking-tighter">cron</span>
            <span className="font-display text-xl italic tracking-tight text-foreground/80">
              .menu
            </span>
          </Link>
          <LivePill />
          <SoundToggle />
          <LanguageSwitcher />
        </header>

        <main className="flex-1 pt-[calc(env(safe-area-inset-top,0)+3.5rem)] pb-[calc(env(safe-area-inset-bottom,0)+5rem)] md:pt-0 md:pb-0">
          {children}
        </main>

        <nav
          className="pwa-locked bottom-0 inset-x-0 z-30 border-t border-foreground/10 bg-background/95 px-2 pt-2 pb-[max(env(safe-area-inset-bottom,0.5rem),0.5rem)] backdrop-blur-xl md:hidden"
          aria-label="Primary"
        >
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))`,
            }}
          >
            {nav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                iconKey={item.iconKey}
                variant="bottom"
                badge={item.badge}
              />
            ))}
          </div>
        </nav>
      </div>

      <InstallPrompt />
    </div>
  );
}
