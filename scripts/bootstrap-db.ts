/**
 * One-shot bootstrap:
 *   1. Applies the push-trigger migration (triggers + realtime publication)
 *   2. Applies the RLS policies
 *   3. Seeds a demo restaurant with tables + menu + an initial live order
 *
 * Idempotent — safe to re-run.
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

async function main() {
  console.log("→ applying push triggers + realtime publication");
  await runSqlFile("supabase/migrations/20260423000000_push_triggers.sql");

  console.log("→ applying RLS policies");
  await runSqlFile("supabase/migrations/20260423000001_rls.sql");

  console.log("→ seeding demo restaurant");
  await seedDemo();

  console.log("✓ bootstrap complete");
}

async function runSqlFile(relPath: string) {
  const full = path.resolve(process.cwd(), relPath);
  const content = fs.readFileSync(full, "utf8");
  await sql.unsafe(content);
}

async function seedDemo() {
  const [existing] = await sql<{ id: string }[]>`
    select id from restaurants where slug = 'demo' limit 1
  `;
  if (existing) {
    console.log("  demo restaurant already seeded — skipping");
    return;
  }

  const [restaurant] = await sql<{ id: string }[]>`
    insert into restaurants (slug, name, default_locale, supported_locales, currency, timezone)
    values (
      'demo',
      'Demo Bistro',
      'en',
      '["en","fr","es","pt","zh"]'::jsonb,
      'USD',
      'UTC'
    )
    returning id
  `;
  const rid = restaurant.id;

  await sql`
    insert into tables (restaurant_id, label)
    select ${rid}, lpad(g::text, 2, '0')
    from generate_series(1, 15) g
  `;

  const [starters, mains, drinks] = await sql<{ id: string }[]>`
    insert into menu_categories (restaurant_id, name_translations, position) values
      (${rid}, ${sql.json({ en: "Starters", fr: "Entrées", es: "Entrantes", pt: "Entradas", zh: "开胃菜" })}, 1),
      (${rid}, ${sql.json({ en: "Mains", fr: "Plats principaux", es: "Principales", pt: "Pratos principais", zh: "主菜" })}, 2),
      (${rid}, ${sql.json({ en: "Drinks", fr: "Boissons", es: "Bebidas", pt: "Bebidas", zh: "饮品" })}, 3)
    returning id
  `;

  const items = [
    {
      cat: starters.id,
      name: { en: "Samosa", fr: "Samoussa", es: "Samosa", pt: "Samosa", zh: "咖喱角" },
      desc: {
        en: "Crispy pastry with spiced beef filling",
        fr: "Pâtisserie croustillante à la viande épicée",
        es: "Empanadilla crujiente con carne especiada",
        pt: "Pastel crocante com recheio de carne temperada",
        zh: "酥脆香辣牛肉角",
      },
      price: 3.5,
      position: 1,
    },
    {
      cat: starters.id,
      name: { en: "Tomato Soup", fr: "Soupe de tomate", es: "Sopa de tomate", pt: "Sopa de tomate", zh: "番茄汤" },
      desc: {
        en: "Fresh roasted tomatoes with basil",
        fr: "Tomates fraîches rôties au basilic",
        es: "Tomates frescos asados con albahaca",
        pt: "Tomates frescos assados com manjericão",
        zh: "新鲜烤番茄配罗勒",
      },
      price: 4.0,
      position: 2,
    },
    {
      cat: mains.id,
      name: { en: "Grilled Beef", fr: "Bœuf grillé", es: "Carne a la parrilla", pt: "Carne grelhada", zh: "烤牛肉" },
      desc: {
        en: "Flame-grilled beef, served with fresh salsa",
        fr: "Bœuf grillé à la flamme, servi avec salsa fraîche",
        es: "Carne a la parrilla con salsa fresca",
        pt: "Carne grelhada com salsa fresca",
        zh: "炭火烤牛肉配莎莎酱",
      },
      price: 12.0,
      position: 1,
    },
    {
      cat: mains.id,
      name: { en: "Margherita Pizza", fr: "Pizza Margherita", es: "Pizza Margherita", pt: "Pizza Margherita", zh: "玛格丽特披萨" },
      desc: {
        en: "Tomato, mozzarella, fresh basil",
        fr: "Tomate, mozzarella, basilic frais",
        es: "Tomate, mozzarella, albahaca fresca",
        pt: "Tomate, mussarela, manjericão fresco",
        zh: "番茄、马苏里拉、新鲜罗勒",
      },
      price: 10.0,
      position: 2,
    },
    {
      cat: drinks.id,
      name: { en: "Masala Chai", fr: "Thé masala", es: "Té masala", pt: "Chá masala", zh: "马萨拉茶" },
      desc: {
        en: "Spiced milk tea",
        fr: "Thé au lait épicé",
        es: "Té con leche especiado",
        pt: "Chá de leite com especiarias",
        zh: "香料奶茶",
      },
      price: 2.0,
      position: 1,
    },
    {
      cat: drinks.id,
      name: { en: "Cappuccino", fr: "Cappuccino", es: "Capuchino", pt: "Cappuccino", zh: "卡布奇诺" },
      desc: {
        en: "Espresso topped with steamed milk foam",
        fr: "Espresso recouvert de mousse de lait",
        es: "Espresso con espuma de leche",
        pt: "Espresso com espuma de leite",
        zh: "浓缩咖啡配奶泡",
      },
      price: 3.5,
      position: 2,
    },
  ];

  for (const it of items) {
    await sql`
      insert into menu_items
        (restaurant_id, category_id, name_translations, description_translations, price, position)
      values
        (${rid}, ${it.cat}, ${sql.json(it.name)}, ${sql.json(it.desc)}, ${it.price}, ${it.position})
    `;
  }

  console.log(`  seeded restaurant '${rid}' — 15 tables, 3 categories, 6 items`);
}

main()
  .catch((e) => {
    console.error(e);
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
