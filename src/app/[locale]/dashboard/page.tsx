import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardInbox } from "./inbox";
import { NotificationsPrompt } from "./notifications-prompt";
import { getCurrentStaff } from "@/lib/auth/current-user";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  // Next 15+ renders page + layout in parallel — repeat the auth gate here
  // so we never dereference a null `me` if the layout's redirect hasn't
  // finished first.
  const me = await getCurrentStaff();
  if (!me) redirect(`/${locale}/login`);

  const today = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const stats = [
    { key: "activeOrders" as const, count: 0 },
    { key: "openRequests" as const, count: 0 },
    { key: "tablesActive" as const, count: 0 },
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 md:py-8 lg:px-10">
      <header className="flex flex-col gap-3 border-b border-foreground/10 pb-5 md:flex-row md:items-end md:justify-between md:pb-7">
        <div>
          <div className="font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {today} · {me.restaurantName}
          </div>
          <h1 className="mt-1.5 font-display text-4xl italic leading-[0.95] tracking-tight md:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground md:text-base">
            {t("subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs md:gap-4">
          {stats.map(({ key, count }) => (
            <div
              key={key}
              className="rounded-xl border border-foreground/10 bg-background px-3 py-2.5 md:min-w-[140px] md:px-4 md:py-3"
            >
              <div className="font-tabular text-[9px] uppercase tracking-[0.22em] text-muted-foreground md:text-[10px]">
                {key === "activeOrders"
                  ? t("nav.inbox")
                  : key === "openRequests"
                    ? t("inbox.requests")
                    : t("nav.tables")}
              </div>
              <div className="mt-1 font-display text-2xl italic leading-none tracking-tight md:text-3xl">
                {count}
              </div>
              <div className="mt-1.5 truncate text-[10px] text-muted-foreground md:text-xs">
                {t(`stats.${key}`, { count })}
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="mt-6 md:mt-8 space-y-6">
        <NotificationsPrompt restaurantId={me.restaurantId} />
        <DashboardInbox restaurantId={me.restaurantId} />
      </div>
    </div>
  );
}
