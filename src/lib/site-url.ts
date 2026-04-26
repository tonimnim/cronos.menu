/**
 * Resolves the public site URL used to mint QR sticker URLs and any
 * other external-facing links. Throws in production when no env var
 * is configured, so a misconfigured deploy fails loudly instead of
 * shipping localhost links to printed stickers.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_APP_URL) must be set in production",
      );
    }
    return "http://localhost:3000";
  }
  return raw.replace(/\/$/, "");
}
