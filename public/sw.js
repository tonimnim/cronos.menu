// cron.menu service worker — push notifications + offline awareness.
// Intentionally tiny; every decision-making path lives server-side so we can
// ship behavioural changes without asking users to update an installed PWA.

const CACHE_NAME = "cronmenu-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n.startsWith("cronmenu-"))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// -------- Push --------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data ? event.data.text() : "cron.menu" };
  }

  const {
    title = "cron.menu",
    body = "",
    tag,
    url = "/dashboard",
    badge = "/favicon.svg",
    icon = "/icon-192.png",
    data = {},
    requireInteraction = false,
    silent = false,
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag, // coalesce duplicate pushes for the same order/request
      badge,
      icon,
      renotify: Boolean(tag),
      requireInteraction,
      silent,
      vibrate: [120, 60, 120],
      timestamp: Date.now(),
      data: { url, ...data },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Prefer an already-open dashboard tab on the same origin.
      for (const client of all) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* same-origin navigation might be disallowed; ignore */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

// Subscription can be invalidated by the browser (user clears site data,
// push service rotates keys). Re-subscribe and POST the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldEndpoint = event.oldSubscription?.endpoint;
        const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            replaces: oldEndpoint,
          }),
        });
      } catch (err) {
        // Best-effort: we'll catch this on the next app open.
      }
    })(),
  );
});
