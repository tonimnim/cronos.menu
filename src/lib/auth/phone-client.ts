"use client";

import type { CountryCode } from "libphonenumber-js";
import {
  normalizePhone,
  type NormalizePhoneResult,
} from "./phone";

const PUBLIC_DEFAULT = (
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ?? ""
).toUpperCase();

function fromBrowserLocale(): CountryCode | undefined {
  if (typeof navigator === "undefined") return undefined;
  const candidates = [
    navigator.language,
    ...(navigator.languages ?? []),
  ].filter(Boolean);
  for (const tag of candidates) {
    const match = /-([A-Z]{2})(?:-|$)/i.exec(tag);
    if (match) return match[1].toUpperCase() as CountryCode;
  }
  return undefined;
}

/**
 * Browser-side phone normalization that walks a fallback chain instead of
 * giving up on the first miss:
 *
 *   1. server-detected country (IP geo / Accept-Language / env)
 *   2. the user's browser locale country (navigator.language)
 *   3. `NEXT_PUBLIC_DEFAULT_COUNTRY` env fallback
 *   4. no default — input must be international (`+...`)
 *
 * First successful parse wins. This lets `0705708643` validate as KE on a
 * Kenyan dev machine even when the server couldn't tell where the user is.
 */
export function normalizePhoneLenient(
  input: string,
  serverDefault?: CountryCode,
): NormalizePhoneResult {
  const raw = input?.trim();
  if (!raw) return { ok: false, error: "empty" };

  // Short-circuit: if the user typed `+...`, country is irrelevant.
  if (raw.startsWith("+")) return normalizePhone(raw);

  const browserCountry = fromBrowserLocale();
  const envCountry =
    PUBLIC_DEFAULT && /^[A-Z]{2}$/.test(PUBLIC_DEFAULT)
      ? (PUBLIC_DEFAULT as CountryCode)
      : undefined;

  const chain: (CountryCode | undefined)[] = [
    serverDefault,
    browserCountry,
    envCountry,
    undefined,
  ];

  let lastFail: NormalizePhoneResult = { ok: false, error: "invalid_format" };
  for (const country of chain) {
    const result = normalizePhone(raw, country);
    if (result.ok) return result;
    lastFail = result;
  }
  return lastFail;
}
