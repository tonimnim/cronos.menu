import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { getDb } from "@/db";
import { tables, restaurants } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { tableQrUrl } from "@/lib/tables/qr-url";
import { getSiteUrl } from "@/lib/site-url";
import { PrintSheet } from "./print-sheet";

export default async function PrintTablesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ids?: string; all?: string; size?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard.tables.printSheet");

  const me = await getCurrentStaff();
  if (!me) redirect(`/${locale}/login`);
  if (me.role !== "owner" && me.role !== "admin") {
    redirect(`/${locale}/dashboard`);
  }

  const sp = await searchParams;
  const ids = sp.ids ? sp.ids.split(",").filter(Boolean) : [];
  const all = sp.all === "1";
  const size = sp.size === "full" ? "full" : "card";

  const db = getDb();
  const [restaurant] = await db
    .select({ slug: restaurants.slug, name: restaurants.name })
    .from(restaurants)
    .where(eq(restaurants.id, me.restaurantId))
    .limit(1);
  if (!restaurant) redirect(`/${locale}/dashboard/tables`);

  const baseWhere = and(
    eq(tables.restaurantId, me.restaurantId),
    sql`${tables.archivedAt} is null`,
  );
  const rows = all
    ? await db
        .select({
          id: tables.id,
          label: tables.label,
          position: tables.position,
        })
        .from(tables)
        .where(baseWhere)
        .orderBy(asc(tables.position), asc(tables.createdAt))
    : ids.length > 0
      ? await db
          .select({
            id: tables.id,
            label: tables.label,
            position: tables.position,
          })
          .from(tables)
          .where(and(baseWhere, inArray(tables.id, ids)))
          .orderBy(asc(tables.position), asc(tables.createdAt))
      : [];

  const cards = rows.map((r) => ({
    id: r.id,
    label: r.label,
    qrUrl: tableQrUrl({
      siteUrl: getSiteUrl(),
      restaurantSlug: restaurant.slug,
      tableId: r.id,
    }),
  }));

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <PrintSheet
      cards={cards}
      restaurantName={restaurant.name}
      size={size}
      scanLabel={t("scanLabel")}
      tableTag={t("tableTag")}
      poweredBy={t("poweredBy")}
    />
  );
}
