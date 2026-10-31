/**
 * Documents (lot 3) contre Postgres et Chromium : déclinaisons produites ensemble, dépôt de fichiers,
 * brouillon et visibilité, recherche. Base jetable dans TEST_DATABASE_URL.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrer } from "../scripts/migrer.ts";
import { creerAdmin } from "../scripts/creer-admin.ts";
import type { Acteur } from "@/fonctionnalites/organisation/droits";

const url = process.env.TEST_DATABASE_URL;
const EX = path.resolve(import.meta.dirname, "../../../packages/moteur/exemples/membre-retenu");

/** Gabarit d'exemple publié avec une seconde déclinaison (« story »), pour le formulaire unique. */
function dossierPublie() {
  const manifest = JSON.parse(fs.readFileSync(path.join(EX, "manifest.json"), "utf8"));
  const gabarit = manifest.gabarit;
  gabarit.plans.push({ ...structuredClone(gabarit.plans[0]), plan: "story" });
  const publication = { format: "aeemci-studio/gabarit-publie", revision: 1, publie_le: new Date().toISOString(), nom: "Membre retenu", source: { manifest: "manifest.json" }, gabarit };
  return new Map<string, Buffer>([
    ["membre-retenu/gabarit.publie.json", Buffer.from(JSON.stringify(publication))],
    ["membre-retenu/manifest.json", fs.readFileSync(path.join(EX, "manifest.json"))],
    ["membre-retenu/fond-membre-retenu.png", fs.readFileSync(path.join(EX, "fond-membre-retenu.png"))],
  ]);
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe.skipIf(!url)("documents (Postgres + Chromium)", () => {
  let m: {
    importer: typeof import("@/fonctionnalites/gabarits/importer");
    creer: typeof import("@/fonctionnalites/documents/creer");
    deposer: typeof import("@/fonctionnalites/documents/deposer");
    modifier: typeof import("@/fonctionnalites/documents/modifier");
    docs: typeof import("@/fonctionnalites/documents/requetes");
    gestion: typeof import("@/fonctionnalites/organisation/gestion");
    requetes: typeof import("@/fonctionnalites/organisation/requetes");
    stockage: typeof import("@/serveur/stockage");
  };
  const dossierStockage = fs.mkdtempSync(path.join(os.tmpdir(), "aeemci-documents-test-"));
  let president: Acteur;
  let com1: Acteur;
  let com2: Acteur;
  let culture: Acteur;
  let sansRole: Acteur;

  async function acteur(userId: string): Promise<Acteur> {
    const a = await m.requetes.affectationCourante(userId);
    return { id: userId, estAdministrateur: false, affectation: a && { role: a.role, delegationId: a.delegationId } };
  }
  const rattachement = async (u: Acteur) => ({ mandatId: (await m.requetes.mandatCourant())!.id, delegationId: u.affectation?.delegationId ?? null });
  const titres = async (u: Acteur, f = {}) => (await m.docs.rechercherDocuments(u, f)).map((d) => d.titre).sort();

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await c.end();
    await migrer(url!);
    const { userId } = await creerAdmin(url!, { email: "president@esatic.edu.ci", nom: "Awa Koné", motDePasse: "mot-de-passe-solide", role: "president", mandat: "2026-2027" });
    process.env.DATABASE_URL = url;
    process.env.STOCKAGE_DOSSIER = dossierStockage;
    m = {
      importer: await import("@/fonctionnalites/gabarits/importer"),
      creer: await import("@/fonctionnalites/documents/creer"),
      deposer: await import("@/fonctionnalites/documents/deposer"),
      modifier: await import("@/fonctionnalites/documents/modifier"),
      docs: await import("@/fonctionnalites/documents/requetes"),
      gestion: await import("@/fonctionnalites/organisation/gestion"),
      requetes: await import("@/fonctionnalites/organisation/requetes"),
      stockage: await import("@/serveur/stockage"),
    };
    president = await acteur(userId);
    const communication = await m.gestion.creerDelegation(president, "Cellule communication");
    const delegationCulture = await m.gestion.creerDelegation(president, "Délégation culturelle");
    const ajouter = async (email: string, delegationId: string) =>
      acteur((await m.gestion.ajouterMembre(president, { nom: email, email, role: "membre", delegationId })).userId);
    com1 = await ajouter("com1@esatic.edu.ci", communication);
    com2 = await ajouter("com2@esatic.edu.ci", communication);
    culture = await ajouter("culture@esatic.edu.ci", delegationCulture);
    const ancien = await m.gestion.ajouterMembre(president, { nom: "Ancien", email: "ancien@esatic.edu.ci", role: "membre", delegationId: delegationCulture });
    await m.gestion.retirerDuMandat(president, (await m.requetes.membresDuMandat((await m.requetes.mandatCourant())!.id)).find((x) => x.userId === ancien.userId)!.affectationId);
    sansRole = await acteur(ancien.userId);
  });

  afterAll(() => fs.rmSync(dossierStockage, { recursive: true, force: true }));

  it("un seul formulaire produit toutes les déclinaisons du gabarit", async () => {
    const g = await m.importer.importerGabarit(dossierPublie(), president.id);
    // Photo du membre, comme l'envoie le formulaire (route /api/televersements).
    const { db, schema } = await import("@/serveur/db");
    const cle = `televersements/${com1.id}/photo.jpg`;
    await m.stockage.stockage().ecrire(cle, fs.readFileSync(path.join(EX, "photo-test.jpg")), "image/jpeg");
    const [t] = await db.insert(schema.televersement).values({ userId: com1.id, cle, type: "image/jpeg", taille: 1 }).returning();
    const valeurs = { nom: "Awa Koné", photo: `televersement:${t!.id}` };
    const { id } = await m.creer.creerDocument({ gabaritId: g.gabaritId, revisionId: g.revisionId, valeurs }, com1.id, await rattachement(com1));
    const l = (await m.docs.documentLisible(id, com1))!;
    expect(l.d).toMatchObject({ plan: "membre-retenu", origine: "genere", statut: "publie", visibilite: "delegation" });
    expect(l.d.declinaisons).toEqual([expect.objectContaining({ plan: "story", type: "image/png", largeur: 1080 })]);
    expect((await m.stockage.stockage().lire(l.d.declinaisons[0]!.fichier))?.subarray(1, 4).toString()).toBe("PNG");
    const hd = await m.creer.fichierHauteDefinition(l.d, { id: l.revision!.id, prefixe: l.revision!.prefixe, contenu: l.revision!.contenu }, "story");
    expect(hd.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it("dépose un PDF et une image, reconnus par leur contenu ; refuse le reste", async () => {
    const pdf = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "C:\\scans\\PV AG.pdf", titre: "PV de l'AG" }, com1.id, await rattachement(com1));
    const lp = (await m.docs.documentLisible(pdf.id, com1))!;
    expect(lp.d).toMatchObject({ origine: "depose", type: "application/pdf", nomFichier: "PV AG.pdf", taille: PDF.length, miniature: null, largeur: null, revisionId: null });

    const photo = fs.readFileSync(path.join(EX, "photo-test.jpg"));
    const img = await m.deposer.deposerDocument({ contenu: photo, nomFichier: "affiche.jpg", miniature: photo, largeur: 800, hauteur: 600 }, com1.id, await rattachement(com1));
    const li = (await m.docs.documentLisible(img.id, com1))!;
    expect(li.d).toMatchObject({ type: "image/jpeg", titre: "affiche", largeur: 800, hauteur: 600, miniature: `documents/${img.id}/miniature.jpg` });

    // Une « image » qui n'en est pas une, même avec la bonne extension.
    await expect(m.deposer.deposerDocument({ contenu: Buffer.from("<script>alert(1)</script>"), nomFichier: "x.jpg" }, com1.id, await rattachement(com1))).rejects.toThrow(/Format/);
    // Une miniature qui n'est pas un JPEG est ignorée, le dépôt passe.
    const sansMiniature = await m.deposer.deposerDocument({ contenu: photo, nomFichier: "b.jpg", miniature: PDF }, com1.id, await rattachement(com1));
    expect((await m.docs.documentLisible(sansMiniature.id, com1))!.d.miniature).toBeNull();
  });

  it("brouillon : visible par l'auteur et le bureau seulement, jusqu'à publication", async () => {
    const r = await rattachement(com1);
    const { id } = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "brouillon.pdf", titre: "Budget provisoire", statut: "brouillon" }, com1.id, r);
    expect(await m.docs.documentLisible(id, com2)).toBeNull();
    expect(await m.docs.documentLisible(id, president)).not.toBeNull();
    expect(await titres(com2)).not.toContain("Budget provisoire");
    await m.modifier.modifierDocument(com1, id, { statut: "publie" });
    expect(await m.docs.documentLisible(id, com2)).not.toBeNull();
    expect(await titres(com2)).toContain("Budget provisoire");
  });

  it("visibilité : délégation, section ou bureau ; les listes suivent la même règle que la lecture", async () => {
    const r = await rattachement(com1);
    const section = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "a.pdf", titre: "Programme du Ramadan", visibilite: "section" }, com1.id, r);
    const bureau = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "b.pdf", titre: "Note au bureau", visibilite: "bureau" }, com1.id, r);

    expect(await m.docs.documentLisible(section.id, culture)).not.toBeNull();
    expect(await m.docs.documentLisible(section.id, sansRole)).not.toBeNull();
    expect(await m.docs.documentLisible(bureau.id, com2)).toBeNull();
    expect(await m.docs.documentLisible(bureau.id, president)).not.toBeNull();

    // Chaque document listé est lisible, et chaque document lisible est listé.
    const tous = await m.docs.rechercherDocuments(president, {}, 500);
    for (const u of [com1, com2, culture, sansRole, president]) {
      const listes = new Set((await m.docs.rechercherDocuments(u, {}, 500)).map((d) => d.id));
      for (const d of tous) expect(listes.has(d.id), `${u.id} / ${d.titre}`).toBe((await m.docs.documentLisible(d.id, u)) !== null);
    }
    expect(await titres(culture)).toEqual(["Programme du Ramadan"]);
  });

  it("sans délégation, « délégation » devient « bureau »", async () => {
    const { id } = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "c.pdf", visibilite: "delegation" }, president.id, await rattachement(president));
    expect((await m.docs.documentLisible(id, president))!.d.visibilite).toBe("bureau");
  });

  it("seuls l'auteur et le bureau modifient un document", async () => {
    const { id } = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "d.pdf", titre: "Avant" }, com1.id, await rattachement(com1));
    await expect(m.modifier.modifierDocument(com2, id, { titre: "Piraté" })).rejects.toThrow(/introuvable/);
    await expect(m.modifier.modifierDocument(culture, id, { titre: "Piraté" })).rejects.toThrow(/introuvable/);
    await m.modifier.modifierDocument(president, id, { titre: "  Après  ", visibilite: "section" });
    expect((await m.docs.documentLisible(id, com1))!.d).toMatchObject({ titre: "Après", visibilite: "section" });
    await expect(m.modifier.modifierDocument(com1, id, { titre: "   " })).rejects.toThrow(/titre/);
  });

  it("recherche dans le titre et filtre par auteur, type et statut", async () => {
    expect(await titres(com2, { q: "ramadan" })).toEqual(["Programme du Ramadan"]);
    expect(await titres(com2, { q: "100%" })).toEqual([]); // % pris à la lettre
    expect(await titres(com1, { origine: "genere" })).toEqual(["Membre retenu – Awa Koné"]);
    expect(await titres(com2, { portee: "miens" })).toEqual([]);
    expect((await m.docs.rechercherDocuments(com2, { portee: "autres" })).every((d) => !d.estAMoi)).toBe(true);
    const r = await rattachement(com2);
    await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "e.pdf", titre: "Mon brouillon", statut: "brouillon" }, com2.id, r);
    expect(await titres(com2, { statut: "brouillon" })).toEqual(["Mon brouillon"]);
  });
});
