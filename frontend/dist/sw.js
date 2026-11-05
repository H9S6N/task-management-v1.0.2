/* ============================================================
   Service Worker — نظام إدارة المهام
   يستقبل إشعارات المتصفح (Web Push) ويعرضها حتى لو الموقع مقفل،
   وعلى الموبايل حتى لو المتصفح مقفل كلياً.
   ============================================================ */

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/* استلام رسالة Push من الخادم */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'نظام إدارة المهام', body: event.data ? event.data.text() : 'لديك تحديث جديد' }
  }
  const title = data.title || 'نظام إدارة المهام 📋'
  const options = {
    body: data.body || '',
    icon: data.icon || './icon.png',
    badge: './icon.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [120, 60, 120],
    tag: 'tmb-' + (data.title || '') + '-' + Date.now(),
    data: { url: data.url || './' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

/* فتح التطبيق عند الضغط على الإشعار */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || './'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
