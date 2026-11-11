// Ancienne adresse de Cubit mobile : ce service worker se retire et renvoie vers usecubit.org/app/
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()).then((cs) => cs.forEach((c) => c.navigate('https://usecubit.org/app/')))));
