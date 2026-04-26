// Synth chimes via Web Audio API — no audio assets required.
// Autoplay policy: the audio context must be unlocked by a user gesture before
// it can produce sound. Call `unlockAudio()` inside a click/tap handler.

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;
const MIN_INTERVAL_MS = 400; // don't let a burst of events spam the chime

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as
    | AudioCtor
    | undefined;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function unlockAudio(): boolean {
  const c = getCtx();
  if (!c) return false;
  if (c.state === "suspended") void c.resume();
  return c.state === "running";
}

export function audioReady(): boolean {
  return ctx?.state === "running";
}

export type ChimeVariant = "order" | "request" | "success";

// Two-tone chimes. Each variant is distinguishable by waiters in a busy room.
const variants: Record<ChimeVariant, { tones: number[]; gain: number }> = {
  order: { tones: [523.25, 659.25], gain: 0.18 }, // C5 → E5 (warm)
  request: { tones: [783.99, 659.25], gain: 0.22 }, // G5 → E5 (alert — descending)
  success: { tones: [523.25, 783.99], gain: 0.14 }, // C5 → G5 (pleasant)
};

export function playChime(variant: ChimeVariant = "order"): void {
  const c = getCtx();
  if (!c || c.state !== "running") return;

  const now = performance.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;

  const { tones, gain: peak } = variants[variant];
  const t = c.currentTime;

  tones.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;

    const start = t + i * 0.11;
    // Fast attack, gentle exponential decay
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  });
}

export function tryVibrate(pattern: number | number[] = [120, 80, 120]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // iOS Safari throws on some versions; ignore
  }
}
