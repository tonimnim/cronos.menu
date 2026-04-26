"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import {
  Plus,
  Printer,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type TableRow = {
  id: string;
  label: string;
  position: number;
  createdAt: string;
  qrUrl: string;
};

type Props = {
  initial: TableRow[];
  restaurantName: string;
  locale: string;
};

export function TablesManager({ initial, restaurantName, locale }: Props) {
  const t = useTranslations("dashboard.tables");
  const te = useTranslations("dashboard.tables.errors");
  const router = useRouter();

  const [rows, setRows] = useState<TableRow[]>(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TableRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const printAllHref = useMemo(
    () => `/${locale}/print/tables?all=1`,
    [locale],
  );

  const confirmDelete = useCallback(
    (row: TableRow) => {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      startTransition(async () => {
        const res = await fetch(`/api/tables/${row.id}`, { method: "DELETE" });
        if (!res.ok) {
          setRows(initial);
          toast.error(te("deleteFailed"));
          setDeleteTarget(null);
        } else {
          toast.success(t("deleted"));
          setDeleteTarget(null);
          router.refresh();
        }
      });
    },
    [initial, router, t, te],
  );

  const startRename = (row: TableRow) => {
    setEditingId(row.id);
    setEditingLabel(row.label);
    setEditError(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingLabel("");
    setEditError(null);
  };

  const commitRename = async (row: TableRow) => {
    const label = editingLabel.trim();
    if (!label) {
      setEditError(te("labelRequired"));
      return;
    }
    if (label === row.label) {
      cancelRename();
      return;
    }
    setEditError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tables/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const code: string = payload.error ?? "unknown";
        setEditError(te.has(code) ? te(code) : te("unknown"));
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, label } : r)),
      );
      cancelRename();
      router.refresh();
    });
  };

  const downloadQr = useCallback(async (row: TableRow) => {
    const qrcode = (await import("qrcode")).default;
    const dataUrl = await qrcode.toDataURL(row.qrUrl, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `table-${sanitize(row.label)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const printSingle = useCallback(
    (row: TableRow) => {
      const url = `/${locale}/print/tables?ids=${row.id}`;
      window.open(url, "_blank", "noopener");
    },
    [locale],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("count", { count: rows.length })}
        </p>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <Button variant="outline" size="sm" asChild className="rounded-full">
              <a href={printAllHref} target="_blank" rel="noopener">
                <Printer className="size-3.5" />
                {t("printAll")}
              </a>
            </Button>
          )}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="rounded-full">
                  <Plus className="size-3.5" />
                  {t("add")}
                </Button>
              }
            >
              {t("add")}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <AddTablesForm
                onSuccess={(created) => {
                  setRows((prev) => [...prev, ...created]);
                  setAddOpen(false);
                  router.refresh();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const isEditing = editingId === row.id;
            return (
              <li
                key={row.id}
                className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-background p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          commitRename(row);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <Input
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          autoFocus
                          disabled={isPending}
                          maxLength={40}
                          className="h-9"
                        />
                        <button
                          type="submit"
                          disabled={isPending}
                          aria-label={t("save")}
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          disabled={isPending}
                          aria-label={t("cancel")}
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <div className="font-display text-3xl italic leading-none tracking-tight">
                          {row.label}
                        </div>
                        <span className="font-tabular text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                          {t("labelTag")}
                        </span>
                      </div>
                    )}
                    {editError && isEditing && (
                      <div className="mt-1 font-tabular text-[11px] text-urgent">
                        {editError}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-muted/30 p-2">
                    <QrCode className="size-4 text-foreground/60" strokeWidth={1.75} />
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-4 gap-1 pt-3">
                  <IconAction
                    label={t("download")}
                    onClick={() => downloadQr(row)}
                    icon={<Download className="size-3.5" />}
                  />
                  <IconAction
                    label={t("print")}
                    onClick={() => printSingle(row)}
                    icon={<Printer className="size-3.5" />}
                  />
                  <IconAction
                    label={t("rename")}
                    onClick={() => startRename(row)}
                    icon={<Pencil className="size-3.5" />}
                    disabled={isEditing}
                  />
                  <IconAction
                    label={t("delete")}
                    onClick={() => setDeleteTarget(row)}
                    icon={<Trash2 className="size-3.5" />}
                    danger
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {t("urlHint", { name: restaurantName })}
      </p>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o && !isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget ? t("deleteBody", { label: deleteTarget.label }) : ""}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setDeleteTarget(null)}
              disabled={isPending}
            >
              {t("deleteCancel")}
            </Button>
            <Button
              type="button"
              className="rounded-full bg-urgent text-background hover:bg-urgent/90"
              onClick={() => {
                if (deleteTarget) confirmDelete(deleteTarget);
              }}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("deleteConfirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  icon,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-lg border border-foreground/10 px-2 py-1.5 font-tabular text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors",
        "hover:border-foreground/30 hover:text-foreground",
        danger && "hover:border-urgent/60 hover:bg-urgent/10 hover:text-urgent",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
      aria-label={label}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("dashboard.tables");
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/15 bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-foreground/10 bg-background text-muted-foreground">
        <QrCode className="size-5" strokeWidth={1.5} />
      </div>
      <h3 className="mt-4 font-display text-2xl italic leading-tight md:text-3xl">
        {t("emptyTitle")}
      </h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {t("emptyBody")}
      </p>
      <Button size="sm" onClick={onAdd} className="mt-5 rounded-full">
        <Plus className="size-3.5" />
        {t("add")}
      </Button>
    </div>
  );
}

function AddTablesForm({
  onSuccess,
}: {
  onSuccess: (created: TableRow[]) => void;
}) {
  const t = useTranslations("dashboard.tables");
  const te = useTranslations("dashboard.tables.errors");
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [singleLabel, setSingleLabel] = useState("");
  const [prefix, setPrefix] = useState("");
  const [fromStr, setFromStr] = useState("1");
  const [toStr, setToStr] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const body =
      mode === "single"
        ? { mode, label: singleLabel.trim() }
        : {
            mode,
            prefix: prefix.trim(),
            from: Number.parseInt(fromStr, 10),
            to: Number.parseInt(toStr, 10),
          };

    if (mode === "single" && !body.label) {
      setError(te("labelRequired"));
      return;
    }
    if (mode === "bulk") {
      const { from, to } = body as { from: number; to: number };
      if (Number.isNaN(from) || Number.isNaN(to)) {
        setError(te("rangeInvalid"));
        return;
      }
    }

    startTransition(async () => {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code: string = payload.error ?? "unknown";
        if (code === "duplicate_labels" && payload.duplicates?.length) {
          setError(
            te("duplicateLabels", { labels: payload.duplicates.join(", ") }),
          );
          return;
        }
        if (code === "bulk_limit_exceeded") {
          setError(te("bulkLimitExceeded", { limit: payload.limit }));
          return;
        }
        setError(te.has(code) ? te(code) : te("unknown"));
        return;
      }
      const created: TableRow[] = (payload.created ?? []).map(
        (row: {
          id: string;
          label: string;
          position: number;
          createdAt: string;
          qrUrl: string;
        }) => ({
          id: row.id,
          label: row.label,
          position: row.position,
          createdAt: row.createdAt,
          qrUrl: row.qrUrl,
        }),
      );
      onSuccess(created);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("addTitle")}</DialogTitle>
      </DialogHeader>

      <div className="mt-2 inline-flex rounded-full border border-foreground/10 bg-muted/40 p-1 font-tabular text-[11px] uppercase tracking-[0.18em]">
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(m === "single" ? "addSingle" : "addBulk")}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        {mode === "single" ? (
          <div className="space-y-2">
            <Label htmlFor="label">{t("labelLabel")}</Label>
            <Input
              id="label"
              value={singleLabel}
              onChange={(e) => setSingleLabel(e.target.value)}
              disabled={isPending}
              maxLength={40}
              autoFocus
            />
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="prefix">{t("bulkPrefix")}</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                disabled={isPending}
                maxLength={20}
                placeholder="A-"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="from">{t("bulkFrom")}</Label>
                <Input
                  id="from"
                  type="number"
                  inputMode="numeric"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  disabled={isPending}
                  min={0}
                  max={9999}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">{t("bulkTo")}</Label>
                <Input
                  id="to"
                  type="number"
                  inputMode="numeric"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  disabled={isPending}
                  min={0}
                  max={9999}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("bulkPreview", {
                first: `${prefix}${fromStr || "?"}`,
                last: `${prefix}${toStr || "?"}`,
              })}
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm text-urgent"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="submit"
            className="rounded-full"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("addSubmit")
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "table";
}
