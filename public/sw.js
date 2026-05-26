/* Service worker mínimo para instalación PWA (añadir a pantalla de inicio) */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
