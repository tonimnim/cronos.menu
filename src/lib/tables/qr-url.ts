/**
 * The URL a table QR encodes. We deliberately omit the locale so the proxy's
 * IP/Accept-Language detection picks the right language for the guest — one
 * physical sticker serves every language a restaurant's visitors speak.
 *
 * Using the table UUID (not the label) means renaming a table in the dashboard
 * doesn't invalidate the sticker on the actual furniture.
 */
export function tableQrUrl(params: {
  siteUrl: string;
  restaurantSlug: string;
  tableId: string;
}): string {
  const base = params.siteUrl.replace(/\/$/, "");
  return `${base}/r/${params.restaurantSlug}/t/${params.tableId}`;
}
