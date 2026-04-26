import type { Config } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

// drizzle-kit runs outside Next.js and does NOT inherit .env.local.
// Parse it ourselves; existing process.env wins so CI can override.
loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "";
if (!url || url.includes("[YOUR-PASSWORD]")) {
  throw new Error(
    "DATABASE_URL / DIRECT_DATABASE_URL is missing or still has the [YOUR-PASSWORD] placeholder. " +
      "Open .env.local and paste your real Supabase DB password.",
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;

function loadEnvFile(file: string) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  const content = fs.readFileSync(full, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
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
