import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneToSyntheticEmail } from "@/lib/auth/phone";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { getDb } from "@/db";
import { staffUsers } from "@/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().trim().min(5).max(25),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(60).optional(),
  country: z.string().length(2).optional(),
});

export async function POST(req: Request) {
  const me = await getCurrentStaff();
  if (!me) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (me.role !== "owner" && me.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const phone = normalizePhone(
    parsed.data.phone,
    parsed.data.country as never,
  );
  if (!phone.ok) {
    return NextResponse.json({ error: `phone.${phone.error}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const db = getDb();

  const existing = await db
    .select({ id: staffUsers.userId })
    .from(staffUsers)
    .where(sql`${staffUsers.phone} = ${phone.value.e164}`)
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "phone_already_registered" },
      { status: 409 },
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: phoneToSyntheticEmail(phone.value.e164),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      display_name: parsed.data.displayName ?? null,
      phone: phone.value.e164,
      added_by: me.userId,
    },
  });
  if (createErr || !created.user) {
    const code = createErr?.message?.toLowerCase().includes("already")
      ? "phone_already_registered"
      : "auth_create_failed";
    return NextResponse.json({ error: code }, { status: 409 });
  }

  try {
    await db.insert(staffUsers).values({
      userId: created.user.id,
      restaurantId: me.restaurantId,
      role: "staff",
      phone: phone.value.e164,
      displayName: parsed.data.displayName ?? null,
    });
    return NextResponse.json({ ok: true, userId: created.user.id });
  } catch (err) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => null);
    return NextResponse.json(
      {
        error: "setup_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
