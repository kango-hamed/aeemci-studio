/**
 * Fichiers partagés depuis la galerie du téléphone : le service worker (public/sw.js) les garde dans le
 * cache du navigateur le temps que le membre choisisse où les mettre. Rien ne quitte le téléphone avant.
 */
const CACHE_PARTAGE = "partage-recu";

export async function fichiersPartages(): Promise<File[]> {
  if (typeof caches === "undefined" || !(await caches.has(CACHE_PARTAGE))) return [];
  const cache = await caches.open(CACHE_PARTAGE);
  const requetes = [...(await cache.keys())].sort((a, b) => a.url.localeCompare(b.url, undefined, { numeric: true }));
  const fichiers: File[] = [];
  for (const r of requetes) {
    const rep = await cache.match(r);
    if (!rep) continue;
    const nom = decodeURIComponent(rep.headers.get("x-nom") ?? "fichier");
    fichiers.push(new File([await rep.blob()], nom, { type: rep.headers.get("content-type") ?? "" }));
  }
  return fichiers;
}

export async function oublierPartage(): Promise<void> {
  if (typeof caches !== "undefined") await caches.delete(CACHE_PARTAGE);
}
