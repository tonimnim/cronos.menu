import {
  parsePhoneNumberWithError,
  ParseError,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Synthetic-email domain used to route phone-based auth through Supabase's
 * always-on email provider (so we don't need to enable the Phone provider,
 * which requires an SMS vendor).
 *
 * `.invalid` is RFC 2606 reserved — no email can ever be delivered to it.
 */
export const PHONE_EMAIL_DOMAIN = "cronmenu.invalid";

export type NormalizedPhone = {
  /** E.164 format, e.g. +254712345678. Canonical identifier. */
  e164: string;
  /** Formatted for display, e.g. +254 712 345 678 */
  display: string;
  /** ISO 3166-1 alpha-2 country code for the number, if detected. */
  country: CountryCode | undefined;
};

/**
 * Deterministically map an E.164 phone → a synthetic email.
 * +254712345678 → 254712345678@cronmenu.invalid
 */
export function phoneToSyntheticEmail(e164: string): string {
  return `${e164.replace(/^\+/, "")}@${PHONE_EMAIL_DOMAIN}`;
}

export type NormalizePhoneResult =
  | { ok: true; value: NormalizedPhone }
  | { ok: false; error: "empty" | "invalid_format" | "invalid_number" };

/**
 * Normalize a user-entered phone to E.164. Requires either:
 *   - an international-format number starting with '+'
 *   - OR a national-format number plus an explicit default country code
 *
 * We do NOT verify ownership of the number — this is purely canonical-form
 * validation so two different inputs for the same line (`0712 345 678` vs
 * `+254712345678`) collapse to one identifier.
 */
export function normalizePhone(
  input: string,
  defaultCountry?: CountryCode,
): NormalizePhoneResult {
  const raw = input?.trim();
  if (!raw) return { ok: false, error: "empty" };

  try {
    const parsed = parsePhoneNumberWithError(raw, defaultCountry);
    if (!parsed.isValid()) return { ok: false, error: "invalid_number" };
    return {
      ok: true,
      value: {
        e164: parsed.number,
        display: parsed.formatInternational(),
        country: parsed.country,
      },
    };
  } catch (err) {
    if (err instanceof ParseError) return { ok: false, error: "invalid_format" };
    return { ok: false, error: "invalid_format" };
  }
}
