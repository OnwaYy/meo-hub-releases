// Service worker : l'appli s'ouvre instantanément (coquille en cache), les données viennent toujours du réseau
const CACHE = 'meo-mobile-1.1.2';
const SHELL = ['./', './index.html', './app.css', './app.js', './config.js', './supabase.js', './icon-192.png', './manifest.webmanifest'];
// version.json n'est jamais mis en cache : il sert à détecter les mises à jour
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('version.json')) return; // Supabase et version : jamais en cache
  // Réseau d'abord (pour avoir la dernière version), cache si hors ligne
  // Seuls les fichiers de l'appli sont gardés, sans le « ?v=… » des mises à jour (le cache ne grossit pas)
  const key = new Request(u.origin + u.pathname);
  const keep = SHELL.some((f) => new URL(f, self.registration.scope).pathname === u.pathname);
  e.respondWith(fetch(e.request).then((r) => { if (keep && r.ok) { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(key, c)); } return r; }).catch(() => caches.match(key)));
});
