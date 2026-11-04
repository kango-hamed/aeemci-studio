/**
 * File d'attente des rendus : bornée, avec un délai d'attente, une limite par compte et des aperçus
 * remplaçables. Une place, deux demandes en attente au plus, une seconde d'attente au plus.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

let r: typeof import("@/fonctionnalites/generation/rendu");

beforeAll(async () => {
  vi.stubEnv("RENDUS_SIMULTANES", "1");
  vi.stubEnv("RENDUS_EN_ATTENTE", "2");
  vi.stubEnv("RENDUS_DELAI_ATTENTE_MS", "1000");
  r = await import("@/fonctionnalites/generation/rendu");
});

/** Rendu factice qui occupe sa place jusqu'à `finir()`. */
function rendu() {
  let finir!: () => void;
  const fin = new Promise<void>((ok) => (finir = ok));
  let commence = false;
  return {
    finir,
    get commence() {
      return commence;
    },
    tache: async () => {
      commence = true;
      await fin;
      return "fait";
    },
  };
}

const statut = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof r.ServeurOccupe ? e.statut : e));
const tour = () => new Promise((ok) => setTimeout(ok, 0));

describe("file d'attente des rendus", () => {
  it("file pleine : refusée tout de suite (503), puis les demandes en attente passent dans l'ordre", async () => {
    const [a, b, c] = [rendu(), rendu(), rendu()];
    const pa = r.avecPlace(a.tache);
    const pb = r.avecPlace(b.tache);
    const pc = r.avecPlace(c.tache);
    expect(await statut(r.avecPlace(rendu().tache))).toBe(503);
    await tour();
    expect([a.commence, b.commence, c.commence]).toEqual([true, false, false]);
    a.finir();
    await pa;
    await tour();
    expect(b.commence).toBe(true);
    b.finir();
    c.finir();
    expect(await Promise.all([pb, pc])).toEqual(["fait", "fait"]);
  });

  it("attente trop longue : refusée (503) et retirée de la file", async () => {
    const a = rendu();
    const pa = r.avecPlace(a.tache);
    const enAttente = rendu();
    const debut = Date.now();
    expect(await statut(r.avecPlace(enAttente.tache))).toBe(503);
    expect(Date.now() - debut).toBeGreaterThanOrEqual(900);
    a.finir();
    await pa;
    expect(enAttente.commence).toBe(false);
  });

  it("deux demandes par compte au plus (429) ; la place se libère à la fin du rendu", async () => {
    const [a, b] = [rendu(), rendu()];
    const pa = r.avecPlace(a.tache, { compte: "awa" });
    const pb = r.avecPlace(b.tache, { compte: "awa" });
    expect(await statut(r.avecPlace(rendu().tache, { compte: "awa" }))).toBe(429);
    // Un autre compte n'est pas concerné.
    const autre = rendu();
    const pAutre = r.avecPlace(autre.tache, { compte: "moussa" });
    a.finir();
    await pa;
    const c = rendu();
    const pc = r.avecPlace(c.tache, { compte: "awa" });
    b.finir();
    autre.finir();
    c.finir();
    expect(await Promise.all([pb, pAutre, pc])).toEqual(["fait", "fait", "fait"]);
  });

  it("un aperçu plus récent du même compte remplace celui qui attend (409), sans être refusé", async () => {
    const enCours = rendu();
    const p1 = r.avecPlace(enCours.tache, { compte: "awa", remplacable: true });
    const ancien = rendu();
    const p2 = statut(r.avecPlace(ancien.tache, { compte: "awa", remplacable: true }));
    const recent = rendu();
    const p3 = r.avecPlace(recent.tache, { compte: "awa", remplacable: true });
    expect(await p2).toBe(409);
    enCours.finir();
    await p1;
    recent.finir();
    expect(await p3).toBe("fait");
    expect(ancien.commence).toBe(false);
  });
});
