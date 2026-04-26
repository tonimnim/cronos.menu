import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { getDb } from "@/db";
import { staffUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().uuid(),
});

export async function POST(req: Request) {
  const me = await getCurrentStaff();
  if (!me) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (me.role !== "owner" && me.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (parsed.data.userId === me.userId) {
    return NextResponse.json(
      { error: "cannot_remove_self" },
      { status: 400 },
    );
  }

  const db = getDb();
  const [target] = await db
    .select({
      userId: staffUsers.userId,
      restaurantId: staffUsers.restaurantId,
      role: staffUsers.role,
    })
    .from(staffUsers)
    .where(eq(staffUsers.userId, parsed.data.userId))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.restaurantId !== me.restaurantId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "cannot_remove_owner" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  // Invalidate ALL active sessions for this user across every device.
  await admin.auth.admin.signOut(parsed.data.userId).catch(() => null);
  // Delete the auth user — the staff_users row + push_subscriptions cascade off.
  const { error: delErr } = await admin.auth.admin.deleteUser(
    parsed.data.userId,
  );
  if (delErr) {
    return NextResponse.json(
      { error: "delete_failed", detail: delErr.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
