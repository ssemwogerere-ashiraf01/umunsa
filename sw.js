/* UMUNSA site service worker — offline shell + local push-style notifications */
// Bump this on every deploy that changes anything in PRECACHE (or really any
// static asset) — the old value ('nsa-shell-v1') never changed across
// deploys, so once a browser installed it, style.css and friends were cached
// forever and cache-first for every reload, no matter how many times the
// files changed on disk. That's why the site only ever looked right after a
// hard refresh: a normal reload never had a chance to see anything new.
const CACHE = 'nsa-shell-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/img/favicon-64.png',
  '/assets/img/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Network-first for HTML; cache-first for static assets
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }
  // Stale-while-revalidate for CSS/JS/images: respond instantly from cache
  // if we have it (fast), but always fetch the network copy in the
  // background and overwrite the cache with it. This means a plain reload
  // (not a hard refresh) after any CSS/JS edit picks up the change on the
  // very next load, instead of being stuck with whatever got cached first.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

/* Push event — works when a real Web Push payload is sent from a server.
   Until a push backend is wired, the client can also postMessage local alerts. */
self.addEventListener('push', (event) => {
  let data = { title: 'Nkobazambogo Students\' Association', body: 'Something new is happening on the site.', url: '/' };
  try {
    if (event.data) {
      const parsed = event.data.json ? event.data.json() : JSON.parse(event.data.text());
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      data.body = event.data?.text() || data.body;
    } catch { /* ignore */ }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/img/favicon-64.png',
      badge: '/assets/img/favicon-32.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'nsa-push',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate?.(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(msg.title || 'UMUNSA', {
        body: msg.body || '',
        icon: '/assets/img/favicon-64.png',
        tag: msg.tag || 'nsa-local',
        data: { url: msg.url || '/' },
      })
    );
  }
});
