// Service worker : l'appli s'ouvre instantanément (coquille en cache), les données viennent toujours du réseau
const CACHE = 'meo-mobile-v1';
const SHELL = ['./', './index.html', './app.css', './app.js', './config.js', './supabase.js', './icon-192.png', './manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase : jamais en cache
  // Réseau d'abord (pour avoir la dernière version), cache si hors ligne
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
