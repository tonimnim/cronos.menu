import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { detectDefaultCountry } from "@/lib/auth/country";
import { getDb } from "@/db";
import { staffUsers } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { StaffManager } from "./staff-manager";

export default async function StaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard.staff");

  const me = await getCurrentStaff();
  if (!me) redirect(`/${locale}/login`);
  // Owner-only. Staff role gets bounced back to the inbox.
  if (me.role !== "owner" && me.role !== "admin") {
    redirect(`/${locale}/dashboard`);
  }

  const defaultCountry = await detectDefaultCountry();

  const db = getDb();
  const rows = await db
    .select({
      userId: staffUsers.userId,
      phone: staffUsers.phone,
      displayName: staffUsers.displayName,
      role: staffUsers.role,
      createdAt: staffUsers.createdAt,
    })
    .from(staffUsers)
    .where(eq(staffUsers.restaurantId, me.restaurantId))
    .orderBy(asc(staffUsers.createdAt));

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-5 sm:px-6 md:py-8 lg:px-10">
      <header className="border-b border-foreground/10 pb-5 md:pb-7">
        <div className="font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {me.restaurantName}
        </div>
        <h1 className="mt-1.5 font-display text-4xl italic leading-[0.95] tracking-tight md:text-6xl">
          {t("title")}
        </h1>
      </header>

      <div className="mt-6 md:mt-8">
        <StaffManager
          initial={rows.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          }))}
          currentUserId={me.userId}
          defaultCountry={defaultCountry}
        />
      </div>
    </div>
  );
}
