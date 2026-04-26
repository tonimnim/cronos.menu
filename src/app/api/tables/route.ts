import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { getDb } from "@/db";
import { tables, restaurants } from "@/db/schema";
import { and, eq, max, sql } from "drizzle-orm";
import { tableQrUrl } from "@/lib/tables/qr-url";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LabelSchema = z.string().trim().min(1).max(40);

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single"),
    label: LabelSchema,
  }),
  z.object({
    mode: z.literal("bulk"),
    prefix: z.string().trim().max(20).optional().default(""),
    from: z.number().int().min(0).max(9999),
    to: z.number().int().min(0).max(9999),
  }),
]);

const BULK_LIMIT = 100;

const UNIQUE_LIVE_LABEL_INDEX = "tables_unique_live_label";

// Postgres unique-violation SQLSTATE.
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Detects whether an error thrown by the postgres-js driver represents a
 * unique-violation on our `tables_unique_live_label` partial index.
 *
 * postgres-js attaches the SQLSTATE under `code` on the thrown error; older
 * stacks (or wrapped re-throws) sometimes nest it under `cause`. We check
 * both, plus the constraint identifier, so we don't accidentally swallow
 * an unrelated 23505 (e.g. a future unique constraint added elsewhere).
 */
function isUniqueLiveLabelViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const candidates: unknown[] = [err];
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") candidates.push(cause);

  for (const c of candidates) {
    const e = c as {
      code?: unknown;
      constraint_name?: unknown;
      constraint?: unknown;
    };
    if (e.code !== PG_UNIQUE_VIOLATION) continue;
    const constraint =
      typeof e.constraint_name === "string"
        ? e.constraint_name
        : typeof e.constraint === "string"
          ? e.constraint
          : undefined;
    if (constraint === UNIQUE_LIVE_LABEL_INDEX) return true;
  }
  return false;
}

export async function POST(req: Request) {
  const me = await getCurrentStaff();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (me.role !== "owner" && me.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();

  // Determine starting position by looking at the max current position for
  // this restaurant — keeps natural insertion order stable.
  const [{ max: currentMax } = { max: 0 }] = await db
    .select({ max: max(tables.position) })
    .from(tables)
    .where(eq(tables.restaurantId, me.restaurantId));
  let nextPos = (currentMax ?? 0) + 1;

  let labels: string[];
  if (parsed.data.mode === "single") {
    labels = [parsed.data.label];
  } else {
    const { prefix, from, to } = parsed.data;
    const [start, end] = from <= to ? [from, to] : [to, from];
    const count = end - start + 1;
    if (count > BULK_LIMIT) {
      return NextResponse.json(
        { error: "bulk_limit_exceeded", limit: BULK_LIMIT },
        { status: 400 },
      );
    }
    labels = [];
    for (let i = start; i <= end; i++) {
      labels.push(`${prefix}${i}`);
    }
  }

  // Pre-check duplicates against existing live (non-archived) tables. This is
  // a fast-path for the common case so the user gets a clean 409 without
  // hitting the DB constraint. The partial unique index
  // `tables_unique_live_label` is the actual source of truth (catches the
  // TOCTOU race below).
  const findDuplicateLabels = async () => {
    const existing = await db
      .select({ label: tables.label })
      .from(tables)
      .where(
        and(
          eq(tables.restaurantId, me.restaurantId),
          sql`${tables.archivedAt} is null`,
        ),
      );
    const takenLabels = new Set(existing.map((r) => r.label));
    return labels.filter((l) => takenLabels.has(l));
  };

  const preCheckDuplicates = await findDuplicateLabels();
  if (preCheckDuplicates.length > 0) {
    return NextResponse.json(
      { error: "duplicate_labels", duplicates: preCheckDuplicates },
      { status: 409 },
    );
  }

  const rows = labels.map((label) => ({
    restaurantId: me.restaurantId,
    label,
    position: nextPos++,
  }));

  const insertRows = () =>
    db
      .insert(tables)
      .values(rows)
      .returning({
        id: tables.id,
        label: tables.label,
        position: tables.position,
        createdAt: tables.createdAt,
      });

  let inserted: Awaited<ReturnType<typeof insertRows>>;
  try {
    inserted = await insertRows();
  } catch (err) {
    // Two concurrent bulk creates can both pass the pre-check, then race on
    // INSERT. The partial unique index `tables_unique_live_label` rejects the
    // loser with PG error 23505. Surface it the same way the pre-check does
    // so the client (which already handles `duplicate_labels`) reacts
    // identically. Anything else we re-throw to the framework's error
    // boundary.
    if (isUniqueLiveLabelViolation(err)) {
      const racedDuplicates = await findDuplicateLabels();
      return NextResponse.json(
        { error: "duplicate_labels", duplicates: racedDuplicates },
        { status: 409 },
      );
    }
    throw err;
  }

  // Look up restaurant slug so we can mint each new row's QR URL on the
  // server — the client used to receive an empty placeholder and only
  // get the real URL after a router.refresh round trip, leaving the
  // Download/Print buttons broken in the meantime.
  const [restaurant] = await db
    .select({ slug: restaurants.slug })
    .from(restaurants)
    .where(eq(restaurants.id, me.restaurantId))
    .limit(1);
  const siteUrl = getSiteUrl();
  const restaurantSlug = restaurant?.slug ?? "";

  const created = inserted.map((row) => ({
    ...row,
    qrUrl: tableQrUrl({
      siteUrl,
      restaurantSlug,
      tableId: row.id,
    }),
  }));

  return NextResponse.json({ ok: true, created });
}
