/**
 * Resolve a translated string from a JSONB translations map.
 *
 * Priority:
 *   1. Exact locale match       (e.g. "fr")
 *   2. Restaurant's default locale (e.g. owner set "sw")
 *   3. First non-empty value    (deterministic: the smallest key wins)
 *   4. Empty string             (renderer should hide or fall back)
 */
export function tr(
  translations: Record<string, string> | null | undefined,
  locale: string,
  fallbackLocale?: string | null,
): string {
  if (!translations) return "";
  const pick = (key: string) => {
    const v = translations[key];
    return typeof v === "string" && v.trim().length > 0 ? v : null;
  };

  const primary = pick(locale);
  if (primary) return primary;

  if (fallbackLocale) {
    const fallback = pick(fallbackLocale);
    if (fallback) return fallback;
  }

  const sortedKeys = Object.keys(translations).sort();
  for (const key of sortedKeys) {
    const v = pick(key);
    if (v) return v;
  }
  return "";
}
