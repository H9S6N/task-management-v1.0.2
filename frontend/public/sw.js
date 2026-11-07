/* ============================================================
   Service Worker — نظام إدارة المهام v1.0.2
   - استقبال إشعارات المتصفح (Web Push) حتى لو الموقع مسكر
   - كاش للواجهة: عند انقطاع الخادم يفتح التطبيق ويبين "غير متصل"
     بدل صفحات صيانة مربكة، ويعيد الاتصال تلقائياً
   ============================================================ */
const CACHE = 'tm-cache-v3'
const SHELL = ['./', './index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // طلبات API تمر للشبكة دائماً — بلا كاش (البيانات حية)
  if (url.pathname.includes('/api/')) return
  // تنقل الصفحات: شبكة أولاً والكاش احتياط (يفتح التطبيق حتى لو الخادم سكر)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    )
    return
  }
  // باقي الأصول: كاش أولاً
  if (e.request.method === 'GET' && (url.origin === location.origin)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit ||
        fetch(e.request).then(res => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
          }
          return res
        }).catch(() => hit)
      )
    )
  }
})

/* ============ استقبال الإشعارات ============ */
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { title: 'مهمة جديدة', body: 'افتح التطبيق' } }
  const title = data.title || 'نظام إدارة المهام'
  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [120, 60, 120],
    tag: 'tm-' + Date.now(),
    data: { url: data.url || './' },
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || './'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // لو التطبيق مفتوح — ركز عليه وانتقل للمهمة
      for (const c of list) {
        if ('focus' in c) {
          c.focus()
          if (url && url !== './' && 'navigate' in c) c.navigate(url).catch(() => {})
          return
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
