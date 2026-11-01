/*
 * Service worker d'AEEMCI Studio : rend l'application installable et affiche une page « hors ligne »
 * quand le réseau manque. Les pages et les documents ne sont jamais mis en cache (données privées) ;
 * seuls les fichiers de Next.js (immuables : scripts, styles, polices) et les icônes le sont.
 *
 * Il reçoit aussi les fichiers partagés depuis la galerie du téléphone (le temps de choisir où les
 * mettre, page /partage) et affiche les notifications.
 */
const VERSION = "aeemci-2";
const HORS_LIGNE = "/hors-ligne";
/** Fichiers partagés en attente ; même nom dans fonctionnalites/partage/fichiers.ts. */
const PARTAGE = "partage-recu";
const FIXES = [HORS_LIGNE, "/icone-192.png", "/logo-aeemci-esatic.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FIXES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION && c !== PARTAGE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

/** Partage depuis une autre application (manifeste, `share_target`) : les fichiers attendent dans le cache. */
async function recevoirPartage(requete) {
  const form = await requete.formData();
  const cache = await caches.open(PARTAGE);
  for (const cle of await cache.keys()) await cache.delete(cle);
  let n = 0;
  for (const f of form.getAll("fichiers")) {
    if (typeof f === "string") continue;
    const entetes = { "content-type": f.type || "application/octet-stream", "x-nom": encodeURIComponent(f.name || "fichier") };
    await cache.put(`/partage/fichier/${n++}`, new Response(f, { headers: entetes }));
  }
  return Response.redirect("/partage", 303);
}

self.addEventListener("fetch", (e) => {
  const r = e.request;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  if (r.method === "POST" && url.pathname === "/partage") {
    e.respondWith(recevoirPartage(r).catch(() => Response.redirect("/partage?erreur=1", 303)));
    return;
  }
  if (r.method !== "GET") return;

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

self.addEventListener("push", (e) => {
  let n = {};
  try {
    n = e.data ? e.data.json() : {};
  } catch {
    n = { corps: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(n.titre || "AEEMCI Studio", {
      body: n.corps || "",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      tag: n.etiquette,
      lang: "fr",
      data: { url: n.url || "/" },
    }),
  );
});

// Notification touchée : la page visée, dans la fenêtre de l'application si elle est déjà ouverte.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const cible = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => new URL(f.url).origin === self.location.origin);
      if (ouverte) return ouverte.focus().then((f) => (f ?? ouverte).navigate(cible));
      return self.clients.openWindow(cible);
    }),
  );
});
