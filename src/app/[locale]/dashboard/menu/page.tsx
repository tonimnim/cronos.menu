import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function DashboardMenuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard.menuMgmt");

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            {t("addCategory")}
          </Button>
          <Button size="sm">
            <Plus className="size-4" />
            {t("addItem")}
          </Button>
        </div>
      </div>
      <div className="border border-dashed rounded-lg p-12 text-center text-sm text-muted-foreground">
        {/* TODO: list + CRUD menu categories and items from DB */}
        Menu management — wire to DB next.
      </div>
    </div>
  );
}
