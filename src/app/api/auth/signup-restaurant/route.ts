import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDb } from "@/db";
import { restaurants, staffUsers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by the client AFTER `supabase.auth.signUp({ email, password })` has
 * returned a user. Finishes the restaurant + owner-staff row creation
 * server-side (needs service role — RLS disallows anon writes to these tables).
 *
 * Auth model: the caller passes the just-created `userId`. We verify against
 * auth.users that the user exists, is still unconfirmed (so only freshly-
 * signed-up accounts can trigger this), and has no existing staff row.
 * This makes it safe to expose publicly despite being unauthenticated —
 * attacker would have to win a race AND know someone's user id.
 */
const Body = z.object({
  userId: z.string().uuid(),
  // The most common signup-trap: users paste their email into the
  // restaurant name field. Reject with a specific error code so the client
  // can show a helpful message — and, just as importantly, so a malicious
  // or buggy client can't bypass the check (the slug derived from this
  // value becomes the public QR URL and propagates to printed stickers).
  businessName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine((v) => !v.includes("@"), { message: "looks_like_email" }),
  displayName: z.string().trim().min(1).max(60).optional(),
});

function slugify(name: string): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "restaurant";
  return base;
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const looksLikeEmail = parsed.error.issues.some(
      (i) => i.path[0] === "businessName" && i.message === "looks_like_email",
    );
    return NextResponse.json(
      { error: looksLikeEmail ? "restaurant_looks_like_email" : "invalid_body" },
      { status: 400 },
    );
  }
  const { userId, businessName, displayName } = parsed.data;

  const admin = createAdminClient();
  const db = getDb();

  // Guard 1: the user must exist in auth.
  const { data: authLookup, error: lookupErr } =
    await admin.auth.admin.getUserById(userId);
  if (lookupErr || !authLookup?.user) {
    return NextResponse.json({ error: "auth_user_not_found" }, { status: 404 });
  }
  const authUser = authLookup.user;

  // Guard 2: the user must not already own a restaurant (prevents re-calls).
  const [existing] = await db
    .select({ id: staffUsers.userId })
    .from(staffUsers)
    .where(eq(staffUsers.userId, userId))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "already_onboarded" },
      { status: 409 },
    );
  }

  try {
    const baseSlug = slugify(businessName);
    let slug = baseSlug;
    const clash = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(sql`${restaurants.slug} = ${slug}`)
      .limit(1);
    if (clash.length > 0) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const [inserted] = await db
      .insert(restaurants)
      .values({ slug, name: businessName })
      .returning({ id: restaurants.id, slug: restaurants.slug });

    await db.insert(staffUsers).values({
      userId,
      restaurantId: inserted.id,
      role: "owner",
      phone: null,
      displayName: displayName ?? null,
      email: authUser.email ?? null,
    });

    return NextResponse.json({
      ok: true,
      restaurantId: inserted.id,
      slug: inserted.slug,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "setup_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
