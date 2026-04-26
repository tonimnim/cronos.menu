/**
 * Production database bootstrap — idempotent migration runner + verifier.
 *
 *   1. Removes any 'demo' restaurant (and cascade-cleans its data) if present.
 *   2. Applies the push-trigger + realtime publication migration.
 *   3. Applies the RLS policy migration.
 *   4. Applies the partial unique index on tables(restaurant_id, label).
 *   5. Verifies RLS state, policy count, and the customer-scan hot-path indexes.
 *
 * Safe to re-run any time. Does NOT seed demo data — production database
 * is intentionally empty and waits for real signups via the auth flow.
 *
 * Usage:  npm run db:bootstrap
 */

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

loadEnvFile(".env.local");

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing DATABASE_URL / DIRECT_DATABASE_URL in .env.local");
  process.exit(1);
}
if (dbUrl.includes("[YOUR-PASSWORD]")) {
  console.error("DATABASE_URL still has [YOUR-PASSWORD] placeholder.");
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, onnotice: () => {} });

// Indexes the customer QR-scan page depends on. Verified after migrations run.
const HOT_PATH_INDEXES: { table: string; index: string; why: string }[] = [
  { table: "restaurants", index: "restaurants_slug_unique", why: "slug → restaurant lookup (unique)" },
  { table: "tables", index: "tables_pkey", why: "table UUID lookup" },
  { table: "tables", index: "tables_restaurant_idx", why: "restaurant → all tables" },
  { table: "tables", index: "tables_live_idx", why: "dashboard live tables (partial: archived_at IS NULL)" },
  { table: "tables", index: "tables_unique_live_label", why: "race-safe duplicate-label guard (partial unique)" },
  { table: "menu_categories", index: "menu_categories_rid_pos_idx", why: "categories ordered by position" },
  { table: "menu_items", index: "menu_items_available_idx", why: "available items by position (partial: available = true)" },
  { table: "orders", index: "orders_restaurant_status_idx", why: "dashboard inbox order list" },
  { table: "requests", index: "requests_restaurant_status_idx", why: "dashboard inbox request list" },
];

async function main() {
  console.log("→ removing demo data if present");
  await cleanDemo();

  console.log("→ applying push triggers + realtime publication");
  await runSqlFile("supabase/migrations/20260423000000_push_triggers.sql");

  console.log("→ applying RLS policies");
  await runSqlFile("supabase/migrations/20260423000001_rls.sql");

  console.log("→ applying tables_unique_live_label partial unique index");
  await runSqlFile("supabase/migrations/20260424000000_tables_unique_label.sql");

  console.log("→ verifying production state");
  await verify();

  console.log("✓ database is production-ready");
}

/**
 * Cascade-deletes the 'demo' restaurant and everything that hangs off it.
 * Order matters: order_items.menu_item_id has ON DELETE RESTRICT, so we drain
 * orders (which cascades to order_items) before the restaurants delete fires
 * the menu_items cascade.
 */
async function cleanDemo() {
  const removed = await sql.begin(async (tx) => {
    await tx`
      delete from order_items
      where order_id in (
        select o.id from orders o
        join restaurants r on o.restaurant_id = r.id
        where r.slug = 'demo'
      )
    `;
    await tx`
      delete from orders
      where restaurant_id in (select id from restaurants where slug = 'demo')
    `;
    return tx<{ id: string; name: string }[]>`
      delete from restaurants where slug = 'demo' returning id, name
    `;
  });
  if (removed.length > 0) {
    console.log(`  removed demo restaurant '${removed[0].name}' (${removed[0].id})`);
  } else {
    console.log("  no demo restaurant found");
  }
}

async function runSqlFile(relPath: string) {
  const full = path.resolve(process.cwd(), relPath);
  const content = fs.readFileSync(full, "utf8");
  await sql.unsafe(content);
}

async function verify() {
  // 1. RLS enabled on every tenant table
  const tenantTables = [
    "restaurants", "tables", "menu_categories", "menu_items",
    "orders", "order_items", "requests", "staff_users", "push_subscriptions",
  ];
  const rls = await sql<{ tablename: string; rowsecurity: boolean }[]>`
    select tablename, rowsecurity from pg_tables
    where schemaname='public' and tablename = any(${tenantTables})
    order by tablename
  `;
  const rlsOff = rls.filter((r) => !r.rowsecurity);
  if (rlsOff.length > 0) {
    throw new Error(`RLS off on: ${rlsOff.map((r) => r.tablename).join(", ")}`);
  }
  console.log(`  ✓ RLS enabled on all ${rls.length} tenant tables`);

  // 2. Policies present
  const [{ cnt: polCnt }] = await sql<{ cnt: number }[]>`
    select count(*)::int as cnt from pg_policies where schemaname='public'
  `;
  if (polCnt < 12) {
    throw new Error(`Only ${polCnt} RLS policies found — expected ≥ 12`);
  }
  console.log(`  ✓ ${polCnt} RLS policies in place`);

  // 3. Customer-scan hot-path indexes
  const indexes = await sql<{ tablename: string; indexname: string }[]>`
    select tablename, indexname from pg_indexes where schemaname='public'
  `;
  const have = new Set(indexes.map((i) => `${i.tablename}.${i.indexname}`));
  const missing = HOT_PATH_INDEXES.filter((h) => !have.has(`${h.table}.${h.index}`));
  if (missing.length > 0) {
    console.error("  ✗ Missing indexes:");
    for (const m of missing) console.error(`     - ${m.table}.${m.index} — ${m.why}`);
    throw new Error("Run `npm run db:push` to sync drizzle schema, then re-run this.");
  }
  console.log(`  ✓ all ${HOT_PATH_INDEXES.length} customer-scan hot-path indexes present`);

  // 4. Realtime publication coverage
  const pub = await sql<{ tablename: string }[]>`
    select tablename from pg_publication_tables where pubname='supabase_realtime'
  `;
  const need = new Set(["orders", "order_items", "requests"]);
  const have2 = new Set(pub.map((p) => p.tablename));
  for (const n of need) {
    if (!have2.has(n)) throw new Error(`'${n}' missing from supabase_realtime publication`);
  }
  console.log(`  ✓ realtime publication covers orders, order_items, requests`);

  // 5. Triggers wired
  const trg = await sql<{ trigger_name: string; event_object_table: string }[]>`
    select trigger_name, event_object_table from information_schema.triggers
    where trigger_schema='public' and event_object_table in ('orders','requests')
  `;
  const trgPairs = new Set(trg.map((t) => `${t.event_object_table}.${t.trigger_name}`));
  if (!trgPairs.has("orders.on_order_insert_notify")) {
    throw new Error("trigger on_order_insert_notify missing on orders");
  }
  if (!trgPairs.has("requests.on_request_insert_notify")) {
    throw new Error("trigger on_request_insert_notify missing on requests");
  }
  console.log(`  ✓ insert-notify triggers wired on orders + requests`);

  // 6. Final tenant + auth user counts
  const [{ rest_cnt }] = await sql<{ rest_cnt: number }[]>`
    select count(*)::int as rest_cnt from public.restaurants
  `;
  const [{ auth_cnt }] = await sql<{ auth_cnt: number }[]>`
    select count(*)::int as auth_cnt from auth.users
  `;
  console.log(`  ℹ ${rest_cnt} restaurant(s), ${auth_cnt} auth user(s)`);
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => sql.end({ timeout: 5 }));

function loadEnvFile(file: string) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
