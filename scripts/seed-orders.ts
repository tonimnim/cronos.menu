/**
 * Seed a handful of live orders + requests against the `demo` restaurant so
 * the dashboard has something to show. Each item is timestamped at a
 * different offset so all three urgency tiers (calm/warm/hot) show up.
 *
 * Usage:  npm run db:seed-orders
 */

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

loadEnvFile(".env.local");

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing DB URL in .env.local");
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, onnotice: () => {} });

async function main() {
  const [r] = await sql<{ id: string }[]>`
    select id from restaurants where slug = 'demo' limit 1
  `;
  if (!r) {
    console.error("Demo restaurant not found. Run `npm run db:bootstrap` first.");
    process.exit(1);
  }
  const rid = r.id;

  const tables = await sql<{ id: string; label: string }[]>`
    select id, label from tables where restaurant_id = ${rid} order by label
  `;
  const byLabel = new Map(tables.map((t) => [t.label, t.id]));

  const items = await sql<{ id: string; price: string; name: { en: string } }[]>`
    select id, price, name_translations as name from menu_items
    where restaurant_id = ${rid}
  `;
  const findItem = (needle: string) =>
    items.find((i) => i.name.en.toLowerCase().includes(needle))!;

  type OrderSpec = {
    tableLabel: string;
    minutesAgo: number;
    items: { needle: string; qty: number }[];
  };

  const orderSpecs: OrderSpec[] = [
    {
      tableLabel: "05",
      minutesAgo: 2,
      items: [
        { needle: "grilled", qty: 1 },
        { needle: "chai", qty: 2 },
      ],
    },
    {
      tableLabel: "03",
      minutesAgo: 8,
      items: [{ needle: "pizza", qty: 1 }],
    },
    {
      tableLabel: "11",
      minutesAgo: 15,
      items: [
        { needle: "samosa", qty: 2 },
        { needle: "tomato", qty: 1 },
      ],
    },
  ];

  for (const spec of orderSpecs) {
    const tableId = byLabel.get(spec.tableLabel);
    if (!tableId) continue;
    const createdAt = new Date(Date.now() - spec.minutesAgo * 60_000);
    const [order] = await sql<{ id: string }[]>`
      insert into orders (restaurant_id, table_id, locale, status, created_at)
      values (${rid}, ${tableId}, 'en', 'pending', ${createdAt})
      returning id
    `;
    for (const it of spec.items) {
      const menuItem = findItem(it.needle);
      await sql`
        insert into order_items (order_id, menu_item_id, quantity, unit_price, name_snapshot)
        values (${order.id}, ${menuItem.id}, ${it.qty}, ${menuItem.price}, ${menuItem.name.en})
      `;
    }
  }

  const requestSpecs = [
    { tableLabel: "07", note: "Bring the bill, please", minutesAgo: 1 },
    { tableLabel: "02", note: "Water please", minutesAgo: 4 },
    { tableLabel: "09", note: "No one has come yet", minutesAgo: 9 },
  ];
  for (const spec of requestSpecs) {
    const tableId = byLabel.get(spec.tableLabel);
    if (!tableId) continue;
    const createdAt = new Date(Date.now() - spec.minutesAgo * 60_000);
    await sql`
      insert into requests (restaurant_id, table_id, note, status, created_at)
      values (${rid}, ${tableId}, ${spec.note}, 'new', ${createdAt})
    `;
  }

  console.log("✓ seeded 3 orders + 3 requests for demo restaurant");
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
