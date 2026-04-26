"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Card = { id: string; label: string; qrUrl: string };

type Props = {
  cards: Card[];
  restaurantName: string;
  size: "card" | "full";
  scanLabel: string;
  tableTag: string;
  poweredBy: string;
};

export function PrintSheet({
  cards,
  restaurantName,
  size,
  scanLabel,
  tableTag,
  poweredBy,
}: Props) {
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [loadedIds, setLoadedIds] = useState<Set<string>>(() => new Set());
  const hasPrintedRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qrcode = (await import("qrcode")).default;
      const entries = await Promise.all(
        cards.map(async (c) => {
          const dataUrl = await qrcode.toDataURL(c.qrUrl, {
            width: 800,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#000000", light: "#FFFFFF" },
          });
          return [c.id, dataUrl] as const;
        }),
      );
      if (cancelled) return;
      setQrImages(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [cards]);

  // Auto-print once every QR <img> has decoded. RAF used to fire before the
  // next paint, so on slower devices the print dialog could capture blank
  // squares — now we wait for onLoad on each <img>, then yield one tick via
  // setTimeout(..., 0) to let the browser flush the paint queue.
  useEffect(() => {
    if (cards.length === 0) return;
    if (hasPrintedRef.current) return;
    if (loadedIds.size < cards.length) return;
    hasPrintedRef.current = true;
    const t = setTimeout(() => {
      window.print();
    }, 0);
    return () => {
      clearTimeout(t);
    };
  }, [loadedIds, cards.length]);

  // Safety net: if an <img> fails to load (e.g. a malformed dataURL), still
  // fire the print dialog after 5 seconds so staff are never stuck.
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasPrintedRef.current) return;
      hasPrintedRef.current = true;
      window.print();
    }, 5000);
    return () => {
      clearTimeout(t);
    };
  }, []);

  return (
    <div
      className={cn(
        "mx-auto w-full bg-white py-6 text-black print:p-0",
        size === "full" ? "max-w-[860px]" : "max-w-[860px]",
      )}
    >
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { background: #ffffff !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-grid { gap: 10mm; }
          .print-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between px-6">
        <div className="font-tabular text-[10px] uppercase tracking-[0.22em] text-neutral-500">
          {restaurantName}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-black/15 px-4 py-1.5 font-tabular text-[11px] uppercase tracking-[0.18em] hover:bg-black hover:text-white"
        >
          Print
        </button>
      </div>

      <div
        className={cn(
          "print-grid grid px-6",
          size === "full" ? "grid-cols-1 gap-10" : "grid-cols-2 gap-8",
        )}
      >
        {cards.map((card) => (
          <article
            key={card.id}
            className={cn(
              "print-card flex flex-col items-center justify-center rounded-3xl border border-black bg-white p-6 text-center",
              size === "full" ? "min-h-[260mm]" : "aspect-[3/4]",
            )}
          >
            <div className="font-tabular text-[10px] uppercase tracking-[0.3em] text-neutral-500">
              {restaurantName}
            </div>

            <div
              className="mt-4 font-display italic leading-none tracking-tight"
              style={{ fontSize: size === "full" ? "96px" : "64px" }}
            >
              {card.label}
            </div>
            <div className="mt-1 font-tabular text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              {tableTag}
            </div>

            <div className="mt-6 flex items-center justify-center">
              {qrImages[card.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImages[card.id]}
                  alt={`QR ${card.label}`}
                  className="block"
                  onLoad={() => {
                    setLoadedIds((prev) => {
                      if (prev.has(card.id)) return prev;
                      const next = new Set(prev);
                      next.add(card.id);
                      return next;
                    });
                  }}
                  style={{
                    width: size === "full" ? "120mm" : "62mm",
                    height: size === "full" ? "120mm" : "62mm",
                    imageRendering: "pixelated",
                  }}
                />
              ) : (
                <div
                  className="bg-neutral-100"
                  style={{
                    width: size === "full" ? "120mm" : "62mm",
                    height: size === "full" ? "120mm" : "62mm",
                  }}
                />
              )}
            </div>

            <div className="mt-5 font-display text-lg italic">{scanLabel}</div>

            <div className="mt-auto pt-4 font-tabular text-[9px] uppercase tracking-[0.22em] text-neutral-500">
              {poweredBy}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
