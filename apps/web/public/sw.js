/*
 * Service worker d'AEEMCI Studio : rend l'application installable et affiche une page « hors ligne »
 * quand le réseau manque. Les pages et les documents ne sont jamais mis en cache (données privées) ;
 * seuls les fichiers de Next.js (immuables : scripts, styles, polices) et les icônes le sont.
 */
const VERSION = "aeemci-1";
const HORS_LIGNE = "/hors-ligne";
const FIXES = [HORS_LIGNE, "/icone-192.png", "/logo-aeemci-esatic.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FIXES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;

  // Page demandée : toujours le réseau ; sans réseau, la page « hors ligne ».
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).catch(() => caches.match(HORS_LIGNE)));
    return;
  }
  // Fichiers de Next.js, nommés d'après leur contenu : le cache d'abord.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(r).then(
        (trouve) =>
          trouve ??
          fetch(r).then((rep) => {
            if (rep.ok) {
              const copie = rep.clone();
              caches.open(VERSION).then((c) => c.put(r, copie));
            }
            return rep;
          }),
      ),
    );
  }
});
