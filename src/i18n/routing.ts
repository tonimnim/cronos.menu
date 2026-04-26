import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "es", "pt", "zh"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
  zh: "中文",
};

/**
 * Weak IP-geo hint → locale mapping.
 *
 * ONLY consulted after Accept-Language matching fails. Multilingual
 * countries (BE, CH, CA, LU, SG, IN, …) are deliberately excluded so we
 * don't silently pick the wrong language for a majority of users in
 * those regions — they fall through to the default locale (en) until
 * the user's browser signals a preference or they pick manually.
 *
 * The NEXT_LOCALE cookie always wins over both of the above.
 */
export const countryToLocale: Record<string, Locale> = {
  // French — France + monolingual francophone Africa
  FR: "fr", MC: "fr",
  SN: "fr", CI: "fr", ML: "fr", BF: "fr", NE: "fr", TG: "fr", BJ: "fr",
  CM: "fr", GA: "fr", CD: "fr", CG: "fr", MG: "fr",

  // Spanish — Spain + Latin America
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es",

  // Portuguese — Portugal + lusophone world
  PT: "pt", BR: "pt", MZ: "pt", AO: "pt", CV: "pt", GW: "pt", ST: "pt",

  // Chinese — Mainland + Chinese-majority SARs
  CN: "zh", TW: "zh", HK: "zh", MO: "zh",

  // Explicitly NOT mapped (multilingual — lean on Accept-Language):
  //   BE Belgium (fr/nl/de)       CH Switzerland (de/fr/it/rm)
  //   CA Canada (en/fr)           LU Luxembourg (lb/fr/de)
  //   SG Singapore (en/zh/ms/ta)  IN India (hi/en/…)
};
