"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX } from "lucide-react";
import { useSoundPref } from "@/hooks/use-sound-pref";
import { playChime, unlockAudio } from "@/lib/sound/chime";
import { cn } from "@/lib/utils";

export function SoundToggle({ className }: { className?: string }) {
  const t = useTranslations("dashboard.sound");
  const { enabled, toggle, hydrated } = useSoundPref();

  const onClick = useCallback(() => {
    if (!enabled) {
      // Enabling — first unlock the audio context within the user gesture,
      // then play a sample so the waiter hears what it sounds like.
      if (unlockAudio()) {
        window.setTimeout(() => playChime("success"), 40);
      }
    }
    toggle();
  }, [enabled, toggle]);

  if (!hydrated) {
    return (
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full",
          className,
        )}
        aria-hidden
      />
    );
  }

  const label = enabled ? t("mute") : t("unmute");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full border transition-colors",
        enabled
          ? "border-foreground/15 bg-foreground text-background hover:bg-foreground/90"
          : "border-foreground/15 bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        className,
      )}
    >
      {enabled ? (
        <Volume2 className="size-4" strokeWidth={2} />
      ) : (
        <VolumeX className="size-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
