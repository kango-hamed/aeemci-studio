/**
 * Gabarits dans la plateforme (lot 6) contre Postgres et Chromium : import du dossier brut du plugin en
 * brouillon, droits des designers, réglages et aperçu, publication, réglages repris à la version suivante,
 * remise en service d'une révision, réservation à des délégations. Base jetable dans TEST_DATABASE_URL.
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

/** Dossier tel que le plugin Photoshop le produit : manifest, fond, et le PSD (ignoré). */
function dossierPlugin() {
  return new Map<string, Buffer>([
    ["membre-retenu/manifest.json", fs.readFileSync(path.join(EX, "manifest.json"))],
    ["membre-retenu/fond-membre-retenu.png", fs.readFileSync(path.join(EX, "fond-membre-retenu.png"))],
  ]);
}

describe.skipIf(!url)("gabarits dans la plateforme (Postgres + Chromium)", () => {
  let m: {
    importer: typeof import("@/fonctionnalites/gabarits/importer");
    atelier: typeof import("@/fonctionnalites/gabarits/atelier");
    gabarits: typeof import("@/fonctionnalites/gabarits/requetes");
    gestion: typeof import("@/fonctionnalites/organisation/gestion");
    requetes: typeof import("@/fonctionnalites/organisation/requetes");
  };
  const dossierStockage = fs.mkdtempSync(path.join(os.tmpdir(), "aeemci-gabarits-test-"));
  let president: Acteur;
  let designer: Acteur;
  let com: Acteur;
  let culture: Acteur;
  let delegationCulture: string;
  let gabaritId: string;

  async function acteur(userId: string): Promise<Acteur> {
    const a = await m.requetes.affectationCourante(userId);
    return { id: userId, estAdministrateur: false, affectation: a && { role: a.role, delegationId: a.delegationId, designer: a.designer } };
  }

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
      atelier: await import("@/fonctionnalites/gabarits/atelier"),
      gabarits: await import("@/fonctionnalites/gabarits/requetes"),
      gestion: await import("@/fonctionnalites/organisation/gestion"),
      requetes: await import("@/fonctionnalites/organisation/requetes"),
    };
    // creerAdmin fait un administrateur : on retire ce statut pour tester les droits d'un président ordinaire.
    const { db, schema } = await import("@/serveur/db");
    const { eq } = await import("drizzle-orm");
    await db.update(schema.user).set({ estAdministrateur: false }).where(eq(schema.user.id, userId));
    president = await acteur(userId);
    const communication = await m.gestion.creerDelegation(president, "Cellule communication", "COM");
    delegationCulture = await m.gestion.creerDelegation(president, "Délégation culturelle", "CUL");
    const ajouter = async (email: string, delegationId: string) => (await m.gestion.ajouterMembre(president, { nom: email.split("@")[0]!, email, role: "membre", delegationId })).userId;
    const designerId = await ajouter("designer@esatic.edu.ci", communication);
    com = await acteur(await ajouter("com@esatic.edu.ci", communication));
    culture = await acteur(await ajouter("culture@esatic.edu.ci", delegationCulture));
    const [a] = await db.select().from(schema.affectation).where(eq(schema.affectation.userId, designerId));
    await m.gestion.changerDesigner(president, a!.id, true);
    designer = await acteur(designerId);
  });

  afterAll(() => fs.rmSync(dossierStockage, { recursive: true, force: true }));

  it("le dossier brut du plugin devient un brouillon, invisible des membres", async () => {
    const r = await m.importer.importerGabarit(dossierPlugin(), designer.id);
    expect(r).toMatchObject({ nom: "membre-retenu", numero: null, nouveau: true });
    gabaritId = r.gabaritId;
    expect(await m.gabarits.gabaritsDisponibles(designer)).toEqual([]);
    const fiche = await m.gabarits.ficheGabarit(gabaritId);
    expect(fiche).toMatchObject({ revisionCouranteId: null, revisions: [] });
    expect(fiche!.brouillon!.contenu.champs.map((c) => c.nom)).toEqual(["nom", "photo"]);
  });

  it("seuls les administrateurs et les designers règlent et publient", async () => {
    const contenu = (await m.gabarits.ficheGabarit(gabaritId))!.brouillon!.contenu;
    await expect(m.atelier.enregistrerBrouillon(president, gabaritId, contenu)).rejects.toThrow(/Réservé/);
    await expect(m.atelier.publier(com, gabaritId)).rejects.toThrow(/Réservé/);
  });

  it("réglages et aperçu du brouillon, puis publication de la révision 1", async () => {
    const contenu = structuredClone((await m.gabarits.ficheGabarit(gabaritId))!.brouillon!.contenu);
    contenu.champs.reverse();
    contenu.champs.find((c) => c.nom === "nom")!.libelle = "";
    let controles = await m.atelier.enregistrerBrouillon(designer, gabaritId, contenu);
    expect(controles.bloquants).toEqual([expect.stringMatching(/libellé vide/)]);
    await expect(m.atelier.publier(designer, gabaritId)).rejects.toMatchObject({ details: [expect.stringMatching(/libellé vide/)] });

    contenu.champs.find((c) => c.nom === "nom")!.libelle = "Nom du membre retenu";
    controles = await m.atelier.enregistrerBrouillon(designer, gabaritId, contenu);
    expect(controles.bloquants).toEqual([]);
    const apercu = await m.atelier.apercuBrouillon(designer, gabaritId, { contenu, mode: "long" });
    expect(apercu.fichier.subarray(1, 4).toString()).toBe("PNG");
    expect(apercu.rapport.find((z) => z.champ === "nom")).toBeTruthy();

    expect(await m.atelier.publier(designer, gabaritId)).toMatchObject({ numero: 1 });
    const [g] = await m.gabarits.gabaritsDisponibles(com);
    expect(g).toMatchObject({ id: gabaritId, numero: 1, aVignette: true });
    expect((await m.gabarits.gabaritACompleter(gabaritId, com))!.revision.contenu.champs.map((c) => c.nom)).toEqual(["photo", "nom"]);
  });

  it("la version suivante reprend les réglages ; une ancienne révision se remet en service", async () => {
    const r = await m.importer.importerGabarit(dossierPlugin(), designer.id, { gabaritId });
    expect(r).toMatchObject({ gabaritId, nouveau: false, numero: null });
    const brouillon = (await m.gabarits.ficheGabarit(gabaritId))!.brouillon!;
    expect(brouillon.contenu.champs.map((c) => [c.nom, c.libelle])).toEqual([
      ["photo", "Photo du membre"],
      ["nom", "Nom du membre retenu"],
    ]);
    // Les membres gardent la révision 1 tant que le brouillon n'est pas publié.
    expect((await m.gabarits.gabaritACompleter(gabaritId, com))!.revision.numero).toBe(1);
    expect(await m.atelier.publier(designer, gabaritId)).toMatchObject({ numero: 2 });
    const fiche = (await m.gabarits.ficheGabarit(gabaritId))!;
    expect(fiche.revisions.map((x) => x.numero)).toEqual([2, 1]);
    expect(await m.atelier.retablirRevision(designer, gabaritId, fiche.revisions[1]!.id)).toBe(1);
    expect((await m.gabarits.gabaritACompleter(gabaritId, com))!.revision.numero).toBe(1);
  });

  it("modifier les réglages sans Photoshop : brouillon copié de la révision en service", async () => {
    const b = await m.atelier.ouvrirBrouillon(designer, gabaritId);
    expect(b.publieeLe).toBeNull();
    expect((await m.atelier.ouvrirBrouillon(designer, gabaritId)).id).toBe(b.id);
    await m.atelier.abandonnerBrouillon(designer, gabaritId);
    expect((await m.gabarits.ficheGabarit(gabaritId))!.brouillon).toBeNull();
  });

  it("un gabarit réservé ne sert qu'à ses délégations (et au bureau)", async () => {
    await m.atelier.modifierFiche(designer, gabaritId, { nom: "Membre retenu", description: "", delegations: [delegationCulture], actif: true });
    expect(await m.gabarits.gabaritsDisponibles(com)).toEqual([]);
    expect(await m.gabarits.gabaritACompleter(gabaritId, com)).toBeNull();
    expect((await m.gabarits.gabaritsDisponibles(culture)).map((g) => g.nom)).toEqual(["Membre retenu"]);
    expect(await m.gabarits.gabaritsDisponibles(president)).toHaveLength(1);
    await m.atelier.modifierFiche(designer, gabaritId, { nom: "Membre retenu", description: "", delegations: [], actif: false });
    expect(await m.gabarits.gabaritsDisponibles(culture)).toEqual([]);
  });

  it("un gabarit importé puis abandonné avant publication disparaît", async () => {
    const f = dossierPlugin();
    const manifest = JSON.parse(f.get("membre-retenu/manifest.json")!.toString("utf8"));
    manifest.document.nom_fichier = "essai.psd";
    f.set("membre-retenu/manifest.json", Buffer.from(JSON.stringify(manifest)));
    const r = await m.importer.importerGabarit(f, designer.id);
    expect(r).toMatchObject({ nom: "essai", nouveau: true });
    await m.atelier.abandonnerBrouillon(designer, r.gabaritId);
    expect(await m.gabarits.ficheGabarit(r.gabaritId)).toBeNull();
  });
});
