"use client";

import { useCallback, useEffect, useState } from "react";
import { unlockAudio } from "@/lib/sound/chime";

const STORAGE_KEY = "cronmenu:sound-enabled";

export function useSoundPref() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage may be blocked in private mode — default to off
    }
    setHydrated(true);
  }, []);

  const setPref = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    if (next) unlockAudio();
  }, []);

  const toggle = useCallback(() => {
    setPref(!enabled);
  }, [enabled, setPref]);

  return { enabled, toggle, setPref, hydrated };
}
