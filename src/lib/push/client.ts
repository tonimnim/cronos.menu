"use client";

export type PushSupport = {
  supported: boolean;
  reason?: "no-serviceworker" | "no-pushmanager" | "no-notification" | "no-vapid";
};

const STORAGE_DISMISSED = "cronmenu:push-dismissed";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "no-serviceworker" };
  if (!("serviceWorker" in navigator)) return { supported: false, reason: "no-serviceworker" };
  if (!("PushManager" in window)) return { supported: false, reason: "no-pushmanager" };
  if (!("Notification" in window)) return { supported: false, reason: "no-notification" };
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return { supported: false, reason: "no-vapid" };
  return { supported: true };
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    // Same URL across reloads → browser reuses the existing registration.
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function subscribeToPush(params: {
  restaurantId: string;
}): Promise<PushSubscription | null> {
  const support = pushSupport();
  if (!support.supported) return null;

  const reg = await registerServiceWorker();
  if (!reg) return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await postSubscription(existing, params.restaurantId);
    return existing;
  }

  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return null;
  } else if (Notification.permission !== "granted") {
    return null;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    ) as BufferSource,
  });

  await postSubscription(sub, params.restaurantId);
  return sub;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  const ok = await sub.unsubscribe();
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => null);
  return ok;
}

export function markPushDismissed() {
  try {
    localStorage.setItem(STORAGE_DISMISSED, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function isPushDismissed(withinMs = 7 * 24 * 60 * 60 * 1000): boolean {
  try {
    const v = localStorage.getItem(STORAGE_DISMISSED);
    if (!v) return false;
    return Date.now() - Number(v) < withinMs;
  } catch {
    return false;
  }
}

async function postSubscription(sub: PushSubscription, restaurantId: string) {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), restaurantId }),
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
