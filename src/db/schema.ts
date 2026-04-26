import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const orderStatus = pgEnum("order_status", [
  "pending",
  "preparing",
  "served",
  "cancelled",
]);

export const requestStatus = pgEnum("request_status", [
  "new",
  "acknowledged",
  "resolved",
]);

export const staffRole = pgEnum("staff_role", ["owner", "staff", "admin"]);

export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  defaultLocale: text("default_locale").notNull().default("en"),
  supportedLocales: jsonb("supported_locales")
    .$type<string[]>()
    .notNull()
    .default(sql`'["en"]'::jsonb`),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tables_restaurant_idx").on(t.restaurantId),
    // Partial composite index: the dashboard tables list filters on
    // archived_at IS NULL and orders by position. Index-only scan, no sort.
    index("tables_live_idx")
      .on(t.restaurantId, t.position)
      .where(sql`${t.archivedAt} IS NULL`),
    // Partial unique index: enforces (restaurant_id, label) uniqueness for
    // live rows only. Source of truth that prevents the TOCTOU race in the
    // POST /api/tables duplicate-label pre-check. Archived rows are exempt
    // so labels can be re-used after a table is decommissioned.
    uniqueIndex("tables_unique_live_label")
      .on(t.restaurantId, t.label)
      .where(sql`${t.archivedAt} IS NULL`),
  ],
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    nameTranslations: jsonb("name_translations")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("menu_categories_restaurant_idx").on(t.restaurantId),
    // Composite matches the guest menu query: categories for a restaurant
    // ordered by position. Replaces a sort step with a direct index scan.
    index("menu_categories_rid_pos_idx").on(t.restaurantId, t.position),
  ],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => menuCategories.id, {
      onDelete: "set null",
    }),
    nameTranslations: jsonb("name_translations")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    descriptionTranslations: jsonb("description_translations")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    imageUrl: text("image_url"),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("menu_items_restaurant_idx").on(t.restaurantId),
    index("menu_items_category_idx").on(t.categoryId),
    // Hot-path partial index: guest menu query filters available=true and
    // orders by position within restaurant. Archived / unavailable rows
    // never touch this index, keeping it small as the menu churns.
    index("menu_items_available_idx")
      .on(t.restaurantId, t.position)
      .where(sql`${t.available} = true`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("en"),
    status: orderStatus("status").notNull().default("pending"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    servedAt: timestamp("served_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_restaurant_status_idx").on(t.restaurantId, t.status),
    index("orders_table_idx").on(t.tableId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    notes: text("notes"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("en"),
    note: text("note"),
    status: requestStatus("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("requests_restaurant_status_idx").on(t.restaurantId, t.status)],
);

export const staffUsers = pgTable(
  "staff_users",
  {
    userId: uuid("user_id").primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    role: staffRole("role").notNull().default("staff"),
    // Phone is the waiter-login identifier; owners sign up with email so
    // their staff_users row has phone=null. Postgres treats nulls as
    // distinct in UNIQUE constraints, so many owners can coexist.
    phone: text("phone").unique(),
    displayName: text("display_name"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("staff_users_restaurant_idx").on(t.restaurantId),
    index("staff_users_phone_idx").on(t.phone),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => staffUsers.userId, {
      onDelete: "cascade",
    }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (t) => [
    index("push_subs_restaurant_idx").on(t.restaurantId),
    index("push_subs_user_idx").on(t.userId),
  ],
);
