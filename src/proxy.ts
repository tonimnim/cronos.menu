import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing, countryToLocale, type Locale } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

function isLocale(tag: string): tag is Locale {
  return (routing.locales as readonly string[]).includes(tag);
}

/**
 * RFC 4647-compliant Accept-Language matcher.
 *
 * Parses quality scores so `fr;q=0.1, en;q=0.9` correctly picks `en` —
 * the naive split-and-pick-first approach would have returned `fr`.
 * Also tries a base-language fallback (e.g. `en-US` → `en`).
 */
function matchAcceptLanguage(header: string): Locale | null {
  const prefs = header
    .split(",")
    .map((item) => {
      const [tagPart, ...params] = item.trim().split(";");
      const tag = tagPart.trim().toLowerCase();
      let q = 1;
      for (const p of params) {
        const [key, value] = p.trim().split("=");
        if (key === "q") {
          const parsed = Number.parseFloat(value);
          if (!Number.isNaN(parsed)) q = parsed;
        }
      }
      return { tag, q };
    })
    .filter((p) => p.tag && p.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of prefs) {
    if (isLocale(tag)) return tag;
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

function detectLocaleFromRequest(req: NextRequest): Locale {
  const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && isLocale(cookieLocale)) return cookieLocale;

  const acceptLanguage = req.headers.get("accept-language");
  if (acceptLanguage) {
    const matched = matchAcceptLanguage(acceptLanguage);
    if (matched) return matched;
  }

  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-country-code");
  if (country) {
    const mapped = countryToLocale[country.toUpperCase()];
    if (mapped) return mapped;
  }

  return routing.defaultLocale;
}

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const hasLocalePrefix = routing.locales.some(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`),
  );

  if (!hasLocalePrefix) {
    const detected = detectLocaleFromRequest(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${detected}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
