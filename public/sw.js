// BoosterApp service worker — push + notification click only.
// Intentionally does NOT cache app shell; offline support is out of scope for the MVP.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = { title: 'BoosterApp', body: 'Nueva notificación', data: {} }
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch (_) {
      payload.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data || {},
      tag: payload.data?.conversationId || 'boosterapp',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const conversationId = event.notification.data?.conversationId
  const targetUrl = conversationId ? `/chat?c=${conversationId}` : '/chat'

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        const url = new URL(client.url)
        if (url.pathname.startsWith('/chat')) {
          client.focus()
          client.postMessage({ type: 'open-conversation', conversationId })
          return
        }
      }
      await self.clients.openWindow(targetUrl)
    })()
  )
})
