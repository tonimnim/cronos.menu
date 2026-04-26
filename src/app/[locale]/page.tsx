import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import {
  QrCode,
  ShoppingCart,
  Bell,
  Globe,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";

const tickerItems = [
  "TABLE 07 — 2× SAMOSA",
  "TABLE 12 — CALL WAITER",
  "TABLE 03 — 4 ITEMS PLACED",
  "TABLE 19 — 1× CAPPUCCINO",
  "TABLE 05 — CHECK REQUESTED",
  "TABLE 22 — NYAMA CHOMA ×1",
  "TABLE 08 — WATER PLEASE",
  "TABLE 14 — 3 ITEMS PLACED",
  "TABLE 11 — 1× TIRAMISU",
  "TABLE 02 — CALL WAITER",
  "TABLE 17 — 2× MASALA CHAI",
  "TABLE 06 — BILL, PLEASE",
];

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const tc = await getTranslations("common");

  const features = [
    { icon: QrCode, key: "scan" as const, num: "01" },
    { icon: ShoppingCart, key: "order" as const, num: "02" },
    { icon: Bell, key: "callWaiter" as const, num: "03" },
    { icon: Globe, key: "global" as const, num: "04" },
  ];

  const titleWords = t("hero.title").split(/\s+/).filter(Boolean);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-3 lg:px-10">
          <Link href="/" className="group flex items-baseline gap-0.5">
            <span className="text-base font-semibold tracking-tighter">cron</span>
            <span className="font-display text-xl italic tracking-tight text-foreground/80 transition-colors group-hover:text-foreground">
              .menu
            </span>
          </Link>

          <div className="hidden items-center gap-3 font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:flex">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-1.5 animate-ping rounded-full bg-foreground/50" />
              <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
            </span>
            <span>LIVE — {year}.{String(new Date().getMonth() + 1).padStart(2, "0")}</span>
            <span className="text-foreground/20">/</span>
            <span>RESTAURANT OS</span>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild size="sm" className="rounded-full">
              <Link href="/dashboard">
                {t("hero.ctaPrimary")}
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="border-b border-foreground/10">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 overflow-hidden px-6 py-2.5 font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground lg:px-10">
            <div className="flex items-center gap-3 whitespace-nowrap sm:gap-4">
              <span className="text-foreground">EST. 2026</span>
              <span className="hidden text-foreground/20 sm:inline">/</span>
              <span className="hidden sm:inline">VOL. 01 · ISSUE 01</span>
              <span className="hidden text-foreground/20 md:inline">/</span>
              <span className="hidden md:inline">THE RESTAURANT EDITION</span>
            </div>
            <div className="flex items-center gap-3 whitespace-nowrap sm:gap-4">
              <span className="hidden md:inline">PRICE — FREE</span>
              <span className="hidden text-foreground/20 md:inline">/</span>
              <span>FREE FOR KITCHENS</span>
            </div>
          </div>
        </div>

        <section className="relative overflow-x-clip">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-10 -z-10 hidden size-[600px] rounded-full bg-foreground/[0.03] blur-3xl lg:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] grid-paper opacity-60"
          />

          <div className="mx-auto max-w-[1400px] px-6 py-12 sm:py-14 lg:px-10 lg:py-20">
            <div className="grid grid-cols-12 gap-x-6 gap-y-10 lg:gap-y-16">
              <aside className="col-span-12 hidden xl:col-span-1 xl:flex xl:items-start xl:pt-3">
                <span className="font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                  N° 0001 — DINING AT SCAN SPEED
                </span>
              </aside>

              <div className="col-span-12 min-w-0 lg:col-span-8">
                <h1 className="font-display text-foreground">
                  <span className="sr-only">{t("hero.title")}</span>
                  <span aria-hidden className="block">
                    {titleWords.map((word, i) => (
                      <span
                        key={i}
                        className="block italic leading-[0.9] text-[clamp(3rem,11vw,8.5rem)]"
                        style={{
                          paddingLeft: `${i * 0.7}ch`,
                          animation: `hero-rise 0.95s cubic-bezier(0.2, 0.8, 0.2, 1) ${
                            120 + i * 160
                          }ms both`,
                        }}
                      >
                        {word}
                      </span>
                    ))}
                  </span>
                </h1>

                <div className="mt-10 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-10 lg:mt-14">
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden
                      className="mt-3 hidden h-px w-10 shrink-0 bg-foreground sm:block"
                    />
                    <p className="max-w-md text-base leading-relaxed text-foreground/75 lg:text-lg lg:leading-[1.55]">
                      {t("hero.subtitle")}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-4 sm:min-w-[180px]">
                    <Button
                      asChild
                      size="lg"
                      className="group w-full rounded-full px-7 py-6 text-base sm:w-auto"
                    >
                      <Link href="/dashboard">
                        {t("hero.ctaPrimary")}
                        <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Link
                      href="#features"
                      className="group inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="border-b border-foreground/30 pb-1 transition-colors group-hover:border-foreground">
                        {t("hero.ctaSecondary")}
                      </span>
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="col-span-12 flex justify-center lg:col-span-4 lg:justify-end lg:pt-4 xl:col-span-3">
                <Receipt />
              </div>
            </div>
          </div>
        </section>

        <div className="relative border-y border-foreground bg-foreground text-background">
          <div className="flex overflow-hidden py-3.5">
            <div
              className="flex shrink-0 items-center gap-12 whitespace-nowrap pr-12 font-tabular text-[13px] tracking-[0.1em]"
              style={{ animation: "marquee-x 55s linear infinite" }}
            >
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i} className="flex items-center gap-12">
                  <span className="flex items-center gap-3">
                    <span className="text-background/40">▶</span>
                    {item}
                  </span>
                  <span className="text-background/30">║</span>
                </span>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute left-0 top-0 h-full w-20 bg-gradient-to-r from-foreground to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-foreground to-transparent" />
        </div>

        <section id="features" className="relative border-b border-foreground/10">
          <div className="mx-auto max-w-[1400px] px-6 pt-20 lg:px-10 lg:pt-28">
            <div className="mb-10 flex flex-col items-start gap-6 border-b border-foreground/10 pb-8 md:flex-row md:items-end md:justify-between lg:mb-16">
              <div>
                <div className="font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  CH. 01 — THE OFFERING
                </div>
                <h2 className="mt-3 max-w-2xl font-display text-4xl italic leading-[0.95] tracking-tight sm:text-5xl lg:text-7xl">
                  {t("features.title")}
                </h2>
              </div>
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="border-b border-foreground/30 pb-1 group-hover:border-foreground">
                  START YOUR RESTAURANT
                </span>
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] lg:px-10">
            <div className="grid grid-cols-1 gap-px bg-foreground/10 md:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, key, num }) => (
                <div
                  key={key}
                  className="group relative bg-background p-8 transition-colors hover:bg-muted/40 lg:p-10"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-tabular text-[11px] font-medium tracking-[0.22em] text-muted-foreground">
                      {num} /
                    </span>
                    <Icon
                      className="size-5 text-foreground/60 transition-transform duration-500 group-hover:-translate-y-1 group-hover:text-foreground"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="mt-14 font-display text-3xl italic leading-[0.95] tracking-tight lg:mt-20 lg:text-4xl">
                    {t(`features.${key}.title`)}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {t(`features.${key}.desc`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-5 px-6 py-8 font-tabular text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:flex-row md:items-center lg:px-10">
          <div className="flex items-center gap-4">
            <span className="font-display text-base italic tracking-tight text-foreground">
              {tc("appName")}
            </span>
            <span className="text-foreground/20">/</span>
            <span>© {year} — ALL RIGHTS RESERVED</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">MADE FOR RESTAURANTS, EVERYWHERE</span>
            <span className="hidden text-foreground/20 sm:inline">/</span>
            <LanguageSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}

function Receipt() {
  const lines: { label: string; value: string }[] = [
    { label: "TABLE", value: "07" },
    { label: "2× SAMOSA", value: "500" },
    { label: "1× MASALA CHAI", value: "120" },
    { label: "1× NYAMA CHOMA", value: "950" },
  ];

  return (
    <div
      className="relative mx-auto w-full max-w-[280px] -rotate-[2deg] border border-foreground bg-background px-5 py-5 shadow-[12px_14px_0_0_rgba(0,0,0,0.08)] lg:mt-2"
      style={{ animation: "receipt-hover 7s ease-in-out infinite" }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 -top-3 mx-auto h-3 w-20 rounded-t-full border border-b-0 border-foreground bg-background"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 -bottom-2 flex justify-between px-[2px]"
      >
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-background ring-1 ring-foreground/80"
            style={{ clipPath: "inset(50% 0 0 0)" }}
          />
        ))}
      </div>

      <div className="flex items-start justify-between border-b border-dashed border-foreground/30 pb-3 font-tabular text-[10px] uppercase tracking-[0.18em]">
        <span>TICKET #0045</span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-1.5 animate-ping rounded-full bg-foreground/50" />
            <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
          </span>
          LIVE
        </span>
      </div>

      <div className="space-y-1.5 py-3 font-tabular text-[11px] leading-relaxed">
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <span className="truncate">{l.label}</span>
            <span className="shrink-0 tabular-nums">{l.value}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-foreground/30 pt-3 font-tabular text-[11px]">
        <div className="flex items-baseline justify-between font-semibold">
          <span>TOTAL</span>
          <span className="tabular-nums">KSh 1,570</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>PLACED</span>
          <span>00 : 00 : 02 AGO</span>
        </div>
      </div>
    </div>
  );
}
