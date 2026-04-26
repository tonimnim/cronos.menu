import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  restaurantId: z.string().uuid().optional(),
  replaces: z.string().url().optional(),
});

export async function POST(req: Request) {
  // Authenticate. In dev with no env, this will throw; we return 503.
  let userId: string | null = null;
  let restaurantFromAuth: string | null = null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      userId = auth.user.id;
      const { data: staff } = await supabase
        .from("staff_users")
        .select("restaurant_id")
        .eq("user_id", userId)
        .maybeSingle();
      restaurantFromAuth = staff?.restaurant_id ?? null;
    }
  } catch {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { subscription, restaurantId, replaces } = parsed.data;

  // Authorisation: a push sub may only be bound to a restaurant the caller works at.
  const boundRestaurantId = restaurantFromAuth ?? restaurantId ?? null;
  if (!boundRestaurantId) {
    return NextResponse.json({ error: "no_restaurant" }, { status: 400 });
  }
  if (
    restaurantFromAuth &&
    restaurantId &&
    restaurantId !== restaurantFromAuth
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getDb();
  const userAgent = req.headers.get("user-agent") ?? null;

  if (replaces) {
    await db
      .delete(pushSubscriptions)
      .where(sql`${pushSubscriptions.endpoint} = ${replaces}`);
  }

  await db
    .insert(pushSubscriptions)
    .values({
      restaurantId: boundRestaurantId,
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        restaurantId: boundRestaurantId,
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        lastUsedAt: sql`now()`,
        failureCount: 0,
      },
    });

  return NextResponse.json({ ok: true });
}
