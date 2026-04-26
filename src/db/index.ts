import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

// Cache on globalThis so Next.js' dev HMR + webpack module re-exec don't keep
// spawning fresh `postgres` clients, each grabbing connections from Supabase's
// session pooler until it hits MaxClientsInSessionMode.
declare global {
  // eslint-disable-next-line no-var
  var __cronmenuDb: DB | undefined;
  // eslint-disable-next-line no-var
  var __cronmenuPg: ReturnType<typeof postgres> | undefined;
}

export function getDb(): DB {
  if (globalThis.__cronmenuDb) return globalThis.__cronmenuDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (Supabase > Settings > Database > Session pooler).",
    );
  }

  // Keep `max` small — Supabase's shared session pooler is limited, and a
  // single Next.js dev instance doesn't need many concurrent connections.
  // `prepare: false` is required by the transaction/session pooler (no
  // server-side prepared statements).
  const client = postgres(connectionString, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(client, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__cronmenuPg = client;
    globalThis.__cronmenuDb = db;
  }

  return db;
}

export { schema };
