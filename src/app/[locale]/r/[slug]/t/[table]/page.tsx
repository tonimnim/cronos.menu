import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Utensils } from "lucide-react";
import { getDb } from "@/db";
import { restaurants, tables, menuCategories, menuItems } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { tr } from "@/lib/menu/translate";
import { CustomerMenu, type MenuPayload } from "./customer-menu";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; table: string }>;
}) {
  const { locale, slug, table: tableId } = await params;
  setRequestLocale(locale);

  // Malformed table UUID → 404 (prevents DB error on garbage input).
  if (!UUID_RE.test(tableId)) notFound();

  const db = getDb();

  // 1) Resolve the restaurant by slug. Anything else depends on this.
  const [restaurant] = await db
    .select({
      id: restaurants.id,
      slug: restaurants.slug,
      name: restaurants.name,
      currency: restaurants.currency,
      defaultLocale: restaurants.defaultLocale,
    })
    .from(restaurants)
    .where(eq(restaurants.slug, slug))
    .limit(1);

  // Unknown restaurant slug → friendly fallback (no name shown).
  // A printed QR can outlive the restaurant's slug; never 404 the guest.
  if (!restaurant) {
    return <TableUnavailable locale={locale} />;
  }

  // 2) In parallel: validate table, fetch categories, fetch available items.
  const [tableRows, categoryRows, itemRows] = await Promise.all([
    db
      .select({
        id: tables.id,
        label: tables.label,
        archivedAt: tables.archivedAt,
      })
      .from(tables)
      .where(
        and(eq(tables.id, tableId), eq(tables.restaurantId, restaurant.id)),
      )
      .limit(1),
    db
      .select({
        id: menuCategories.id,
        nameTranslations: menuCategories.nameTranslations,
        position: menuCategories.position,
      })
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, restaurant.id))
      .orderBy(asc(menuCategories.position)),
    db
      .select({
        id: menuItems.id,
        categoryId: menuItems.categoryId,
        nameTranslations: menuItems.nameTranslations,
        descriptionTranslations: menuItems.descriptionTranslations,
        price: menuItems.price,
        imageUrl: menuItems.imageUrl,
        position: menuItems.position,
      })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.restaurantId, restaurant.id),
          eq(menuItems.available, true),
        ),
      )
      .orderBy(asc(menuItems.position)),
  ]);

  const tableRow = tableRows[0];

  // The table must exist AND belong to THIS restaurant AND not be archived.
  // (Ownership is implied by the `restaurant_id` filter above; archived check
  // still needed because the filter doesn't exclude archived rows.)
  // Both "missing" and "archived" → friendly fallback in the guest's locale,
  // because a printed QR sticker can outlive its table.
  if (!tableRow || tableRow.archivedAt) {
    return (
      <TableUnavailable locale={locale} restaurantName={restaurant.name} />
    );
  }

  const fallbackLocale = restaurant.defaultLocale;

  const categories: MenuPayload["categories"] = categoryRows.map((cat) => ({
    id: cat.id,
    name: tr(cat.nameTranslations, locale, fallbackLocale),
    items: itemRows
      .filter((it) => it.categoryId === cat.id)
      .map((it) => ({
        id: it.id,
        name: tr(it.nameTranslations, locale, fallbackLocale),
        description: tr(it.descriptionTranslations, locale, fallbackLocale),
        price: Number(it.price),
        imageUrl: it.imageUrl,
      })),
  }));

  const payload: MenuPayload = {
    locale,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      currency: restaurant.currency,
      defaultLocale: restaurant.defaultLocale,
    },
    table: { id: tableRow.id, label: tableRow.label },
    categories,
  };

  const t = await getTranslations("menu");

  return (
    <main className="flex-1 pb-24">
      <header className="border-b bg-muted/30 px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-muted-foreground">
            {t("table", { number: tableRow.label })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("welcome", { restaurant: restaurant.name })}
          </h1>
        </div>
      </header>

      {categories.length === 0 ? (
        <EmptyMenu />
      ) : (
        <CustomerMenu payload={payload} />
      )}
    </main>
  );
}

/**
 * Friendly fallback when a guest scans a QR for a table that no longer
 * exists, has been archived, or points at an unknown restaurant slug.
 * Printed QR stickers outlive their database rows, so 404-ing here would
 * be hostile UX in the middle of dinner.
 *
 * `restaurantName` is shown as a quiet kicker when known; omitted when the
 * slug itself didn't resolve. The visual tone matches the customer-menu
 * surface: tabular kicker, font-display italic headline, generous space.
 */
async function TableUnavailable({
  locale,
  restaurantName,
}: {
  locale: string;
  restaurantName?: string;
}) {
  const t = await getTranslations("customer.tableUnavailable");
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-foreground/10 bg-muted text-muted-foreground">
          <Utensils className="size-5" strokeWidth={1.75} />
        </div>
        {restaurantName && (
          <p className="mt-5 font-tabular text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {restaurantName}
          </p>
        )}
        <h1
          className={`${restaurantName ? "mt-2" : "mt-5"} font-display text-3xl italic leading-tight`}
        >
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("body")}</p>
        <Link
          href={`/${locale}`}
          className="mt-6 inline-flex font-tabular text-[11px] uppercase tracking-[0.2em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          cron.menu
        </Link>
      </div>
    </main>
  );
}

async function EmptyMenu() {
  const t = await getTranslations("menu");
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">{t("emptyMenu")}</p>
    </div>
  );
}
