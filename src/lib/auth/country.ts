import { headers } from "next/headers";
import type { CountryCode } from "libphonenumber-js";
import "server-only";

const COUNTRY_RE = /^[A-Z]{2}$/;

/**
 * Best-effort guess of the user's country, used as a default when parsing
 * locally-formatted phone numbers (e.g. `0712345678` → `+254712345678`).
 *
 * Resolution order, highest confidence first:
 *   1. IP geo header (Vercel / Cloudflare / custom proxy)
 *   2. Accept-Language country suffix (e.g. `en-KE` → `KE`)
 *   3. env override (`NEXT_PUBLIC_DEFAULT_COUNTRY`) for self-hosted setups
 *   4. undefined — caller should require international format (`+...`).
 */
export async function detectDefaultCountry(): Promise<CountryCode | undefined> {
  const h = await headers();

  const geo =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country-code");
  if (geo) {
    const up = geo.toUpperCase();
    if (COUNTRY_RE.test(up)) return up as CountryCode;
  }

  const al = h.get("accept-language");
  if (al) {
    const match = al.match(/-([A-Z]{2})(?:[,;]|$)/i);
    if (match) return match[1].toUpperCase() as CountryCode;
  }

  const env = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY;
  if (env && COUNTRY_RE.test(env.toUpperCase())) {
    return env.toUpperCase() as CountryCode;
  }

  return undefined;
}
