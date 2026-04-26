import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Store } from "lucide-react";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  // TODO: list restaurants from DB
  const restaurants = [
    { id: "1", name: "Demo Bistro", slug: "demo" },
  ];

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("restaurants")}</h1>
        <Button size="sm">
          <Plus className="size-4" />
          {t("createRestaurant")}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {restaurants.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-md bg-muted flex items-center justify-center">
                <Store className="size-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground">/{r.slug}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
