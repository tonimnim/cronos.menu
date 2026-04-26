import { createClient } from "@supabase/supabase-js";
import "server-only";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

/**
 * Service-role Supabase client. Bypasses Row-Level Security — only import
 * from server-side code (API routes, server actions). The `server-only`
 * import at the top will fail the build if this module is dragged into
 * a client component.
 */
export function createAdminClient() {
  if (!url || !key) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in env.",
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
