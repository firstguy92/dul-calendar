const CACHE = 'dul-v4';
const META = 'dul-meta';
const SHELL = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== META).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 같은 도메인의 앱 파일만 다뤄요. 항상 서버에 새 버전이 있는지 먼저 확인하고(브라우저 캐시 무시),
// 오프라인일 때만 저장해 둔 사본을 보여줘요. 동기화 요청은 건드리지 않아요.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ---------- 생리 예정 알림 ----------
// 앱이 저장해 둔 알림 일정(날짜와 문구)을 읽어서, 시간이 된 알림을 한 번씩만 보여줘요.
async function readJSON(key) { const c = await caches.open(META); const r = await c.match(key); return r ? r.json() : null; }
async function writeJSON(key, v) { const c = await caches.open(META); await c.put(key, new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } })); }
async function checkReminders() {
  const data = await readJSON('./__reminders'); if (!data || !Array.isArray(data.list)) return;
  const shown = (await readJSON('./__shown')) || []; const now = Date.now(); let changed = false;
  for (const r of data.list) {
    if (r.at <= now && now - r.at < 3 * 864e5 && !shown.includes(r.id)) {
      await self.registration.showNotification(r.title, { body: r.body, tag: r.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } });
      shown.push(r.id); changed = true;
    }
  }
  if (changed) await writeJSON('./__shown', shown.slice(-60));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'dul-reminders') e.waitUntil(checkReminders()); });
self.addEventListener('message', e => { if (e.data === 'check-reminders') e.waitUntil(checkReminders()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
