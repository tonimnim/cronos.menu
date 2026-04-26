import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { getDb } from "@/db";
import { tables } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  label: z.string().trim().min(1).max(40),
});

async function resolveOwner() {
  const me = await getCurrentStaff();
  if (!me) return { error: "unauthenticated" as const, status: 401 };
  if (me.role !== "owner" && me.role !== "admin") {
    return { error: "forbidden" as const, status: 403 };
  }
  return { me };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await resolveOwner();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  const [target] = await db
    .select({ id: tables.id, restaurantId: tables.restaurantId })
    .from(tables)
    .where(eq(tables.id, id))
    .limit(1);
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target.restaurantId !== auth.me.restaurantId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Prevent renaming into a label that's already in use by another live table.
  const clash = await db
    .select({ id: tables.id })
    .from(tables)
    .where(
      and(
        eq(tables.restaurantId, auth.me.restaurantId),
        eq(tables.label, parsed.data.label),
        sql`${tables.archivedAt} is null`,
        sql`${tables.id} <> ${id}`,
      ),
    )
    .limit(1);
  if (clash.length > 0) {
    return NextResponse.json({ error: "duplicate_label" }, { status: 409 });
  }

  await db
    .update(tables)
    .set({ label: parsed.data.label })
    .where(eq(tables.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await resolveOwner();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  const [target] = await db
    .select({ id: tables.id, restaurantId: tables.restaurantId })
    .from(tables)
    .where(eq(tables.id, id))
    .limit(1);
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target.restaurantId !== auth.me.restaurantId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Soft-delete: preserves order/request history so revenue reports still work.
  await db
    .update(tables)
    .set({ archivedAt: sql`now()` })
    .where(eq(tables.id, id));

  return NextResponse.json({ ok: true });
}
