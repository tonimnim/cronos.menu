import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { getDb } from "@/db";
import { tables, restaurants } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { tableQrUrl } from "@/lib/tables/qr-url";
import { getSiteUrl } from "@/lib/site-url";
import { TablesManager } from "./tables-manager";

export default async function TablesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard.tables");

  const me = await getCurrentStaff();
  if (!me) redirect(`/${locale}/login`);
  if (me.role !== "owner" && me.role !== "admin") {
    redirect(`/${locale}/dashboard`);
  }

  const db = getDb();
  const [restaurant] = await db
    .select({ slug: restaurants.slug })
    .from(restaurants)
    .where(eq(restaurants.id, me.restaurantId))
    .limit(1);

  const rows = await db
    .select({
      id: tables.id,
      label: tables.label,
      position: tables.position,
      createdAt: tables.createdAt,
    })
    .from(tables)
    .where(
      and(
        eq(tables.restaurantId, me.restaurantId),
        sql`${tables.archivedAt} is null`,
      ),
    )
    .orderBy(asc(tables.position), asc(tables.createdAt));

  const initial = rows.map((r) => ({
    id: r.id,
    label: r.label,
    position: r.position,
    createdAt: r.createdAt.toISOString(),
    qrUrl: tableQrUrl({
      siteUrl: getSiteUrl(),
      restaurantSlug: restaurant?.slug ?? "",
      tableId: r.id,
    }),
  }));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6 md:py-8 lg:px-10">
      <header className="border-b border-foreground/10 pb-5 md:pb-7">
        <div className="font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {me.restaurantName}
        </div>
        <h1 className="mt-1.5 font-display text-4xl italic leading-[0.95] tracking-tight md:text-6xl">
          {t("title")}
        </h1>
      </header>

      <div className="mt-6 md:mt-8">
        <TablesManager
          initial={initial}
          restaurantName={me.restaurantName}
          locale={locale}
        />
      </div>
    </div>
  );
}
