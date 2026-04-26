"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Inbox, UtensilsCrossed, Grid3x3, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  inbox: Inbox,
  menu: UtensilsCrossed,
  tables: Grid3x3,
  staff: Users,
} satisfies Record<string, LucideIcon>;

export type NavIconKey = keyof typeof icons;

type Props = {
  href: string;
  label: string;
  iconKey: NavIconKey;
  variant: "sidebar" | "bottom";
  badge?: number;
};

export function NavLink({ href, label, iconKey, variant, badge }: Props) {
  const Icon = icons[iconKey];
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="relative">
          <Icon
            className={cn("size-5 transition-transform", isActive && "scale-110")}
            strokeWidth={isActive ? 2 : 1.6}
          />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-semibold text-background">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span className={cn(isActive && "font-medium")}>{label}</span>
        {isActive && (
          <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-foreground" />
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
      <span className={cn("flex-1", isActive && "font-medium")}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-tabular text-[10px] font-semibold",
            isActive
              ? "bg-background text-foreground"
              : "bg-foreground text-background",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
