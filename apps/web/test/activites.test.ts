/**
 * Activités, passation et archives (lot 5) contre Postgres et Chromium : lecture et modification des
 * activités, documents et photos rattachés, recherche plein texte, points en suspens et dossier de passation,
 * clôture du mandat (lecture seule, nouveau président), import dans un mandat passé.
 * Base jetable dans TEST_DATABASE_URL.
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
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe.skipIf(!url)("activités, passation et archives (Postgres + Chromium)", () => {
  let m: {
    activites: typeof import("@/fonctionnalites/activites/gestion");
    reqActivites: typeof import("@/fonctionnalites/activites/requetes");
    deposer: typeof import("@/fonctionnalites/documents/deposer");
    modifier: typeof import("@/fonctionnalites/documents/modifier");
    docs: typeof import("@/fonctionnalites/documents/requetes");
    gestion: typeof import("@/fonctionnalites/organisation/gestion");
    requetes: typeof import("@/fonctionnalites/organisation/requetes");
    passation: typeof import("@/fonctionnalites/mandats/passation");
    cloture: typeof import("@/fonctionnalites/mandats/cloture");
    archives: typeof import("@/fonctionnalites/mandats/archives");
  };
  const dossierStockage = fs.mkdtempSync(path.join(os.tmpdir(), "aeemci-activites-test-"));
  let president: Acteur;
  let vice: Acteur;
  let responsableCom: Acteur;
  let com: Acteur;
  let culture: Acteur;
  let communication: string;
  let delegationCulture: string;

  async function acteur(userId: string): Promise<Acteur> {
    const a = await m.requetes.affectationCourante(userId);
    return { id: userId, estAdministrateur: false, affectation: a && { role: a.role, delegationId: a.delegationId } };
  }
  const rattachement = async (u: Acteur) => ({ mandatId: (await m.requetes.mandatCourant())!.id, delegationId: u.affectation?.delegationId ?? null });
  const titres = async (u: Acteur, f = {}) => (await m.reqActivites.rechercherActivites(u, f)).map((a) => a.titre).sort();

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
      activites: await import("@/fonctionnalites/activites/gestion"),
      reqActivites: await import("@/fonctionnalites/activites/requetes"),
      deposer: await import("@/fonctionnalites/documents/deposer"),
      modifier: await import("@/fonctionnalites/documents/modifier"),
      docs: await import("@/fonctionnalites/documents/requetes"),
      gestion: await import("@/fonctionnalites/organisation/gestion"),
      requetes: await import("@/fonctionnalites/organisation/requetes"),
      passation: await import("@/fonctionnalites/mandats/passation"),
      cloture: await import("@/fonctionnalites/mandats/cloture"),
      archives: await import("@/fonctionnalites/mandats/archives"),
    };
    president = await acteur(userId);
    communication = await m.gestion.creerDelegation(president, "Cellule communication", "COM");
    delegationCulture = await m.gestion.creerDelegation(president, "Délégation culturelle", "CUL");
    const ajouter = async (email: string, role: "membre" | "responsable_delegation" | "vice_president", delegationId: string | null) =>
      acteur((await m.gestion.ajouterMembre(president, { nom: email.split("@")[0]!, email, role, delegationId })).userId);
    vice = await ajouter("vice@esatic.edu.ci", "vice_president", null);
    responsableCom = await ajouter("resp-com@esatic.edu.ci", "responsable_delegation", communication);
    com = await ajouter("com@esatic.edu.ci", "membre", communication);
    culture = await ajouter("culture@esatic.edu.ci", "membre", delegationCulture);
  });

  afterAll(() => fs.rmSync(dossierStockage, { recursive: true, force: true }));

  it("une activité se lit selon sa visibilité ; les listes suivent la même règle", async () => {
    await m.activites.creerActivite(com, { titre: "Conférence de rentrée", date: "2026-11-14", heure: "15:00", lieu: "Amphi A" });
    await m.activites.creerActivite(com, { titre: "Réunion interne com", date: "2026-11-02", visibilite: "delegation" });
    // Un membre ne choisit pas la délégation : la sienne s'impose.
    const { id } = await m.activites.creerActivite(culture, { titre: "Soirée culturelle", date: "2026-10-01", delegationId: communication });
    expect((await m.reqActivites.activiteLisible(id, president))!.a.delegationId).toBe(delegationCulture);
    expect(await titres(culture)).toEqual(["Conférence de rentrée", "Soirée culturelle"]);
    expect(await titres(responsableCom)).toEqual(["Conférence de rentrée", "Réunion interne com", "Soirée culturelle"]);
    expect(await titres(president)).toHaveLength(3);
    await expect(m.activites.creerActivite(com, { titre: "X", date: "14/11/2026" })).rejects.toThrow(/titre|date/);
  });

  it("modification : l'auteur, le responsable de la délégation et le bureau", async () => {
    const [a] = await m.reqActivites.rechercherActivites(president, { texte: "rentrée" });
    const saisie = { titre: "Conférence de rentrée", date: "2026-11-14", bilan: "Salle comble, 120 participants." };
    await m.activites.modifierActivite(responsableCom, a!.id, saisie);
    await expect(m.activites.modifierActivite(culture, a!.id, saisie)).rejects.toThrow(/Seuls/);
    const autre = await m.activites.creerActivite(responsableCom, { titre: "Atelier affiches", date: "2026-11-20" });
    await expect(m.activites.modifierActivite(com, autre.id, { titre: "Atelier", date: "2026-11-20" })).rejects.toThrow(/Seuls/);
    await m.activites.modifierActivite(vice, autre.id, { titre: "Atelier affiches", date: "2026-11-21" });
  });

  it("photos déposées et documents rattachés à une activité ; recherche plein texte", async () => {
    const [a] = await m.reqActivites.rechercherActivites(president, { texte: "conférence" });
    const r = await m.activites.activitePourDepot(com, a!.id);
    const photo = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "programme.pdf", titre: "Programme des conférences", activiteId: a!.id, visibilite: r.visibilite }, com.id, r);
    const libre = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "budget.pdf", titre: "Budget de la jeunesse" }, com.id, await rattachement(com));
    await m.activites.rattacherDocument(com, libre.id, a!.id);
    expect((await m.docs.rechercherDocuments(com, { activiteId: a!.id })).map((d) => d.id).sort()).toEqual([photo.id, libre.id].sort());
    // Rattaché, un document garde sa propre visibilité : la photo suit l'activité (section), pas le budget (délégation).
    expect((await m.docs.rechercherDocuments(culture, { activiteId: a!.id })).map((d) => d.id)).toEqual([photo.id]);
    await expect(m.activites.rattacherDocument(culture, libre.id, null)).rejects.toThrow(/introuvable/);
    await m.activites.rattacherDocument(com, libre.id, null);
    expect(await m.docs.rechercherDocuments(com, { activiteId: a!.id })).toHaveLength(1);
    // Plein texte en français : pluriel et singulier se retrouvent.
    expect((await m.docs.rechercherDocuments(com, { texte: "conférence" })).map((d) => d.titre)).toEqual(["Programme des conférences"]);
    expect((await m.reqActivites.rechercherActivites(com, { texte: "participants" })).map((x) => x.titre)).toEqual(["Conférence de rentrée"]);
  });

  it("passation : points en suspens par le responsable, dossiers selon les droits, PDF", async () => {
    const mandat = (await m.requetes.mandatCourant())!;
    await m.passation.ecrireNote(responsableCom, communication, "Relancer l'imprimeur pour la facture.");
    await expect(m.passation.ecrireNote(com, communication, "x")).rejects.toThrow(/responsable/);
    await expect(m.passation.ecrireNote(responsableCom, delegationCulture, "x")).rejects.toThrow(/responsable/);
    expect((await m.passation.voletsDuMandat(com, mandat.id)).map((v) => v.nom)).toEqual(["Cellule communication"]);
    expect((await m.passation.voletsDuMandat(president, mandat.id)).map((v) => v.nom)).toEqual(["Bureau exécutif", "Cellule communication", "Délégation culturelle"]);
    expect(await m.passation.dossierPassation(culture, mandat.id, communication)).toBeNull();
    const d = (await m.passation.dossierPassation(com, mandat.id, communication))!;
    expect(d.membres.map((x) => x.role)).toEqual(["Responsable de délégation", "Membre"]);
    expect(d.activites.map((x) => x.titre)).toEqual(["Réunion interne com", "Conférence de rentrée", "Atelier affiches"]);
    expect(d.note).toBe("Relancer l'imprimeur pour la facture.");
    expect(d.documents.map((x) => x.titre)).toContain("Programme des conférences");
    expect((await m.passation.pdfPassation(d)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("clôture : l'ancien mandat passe en lecture seule, le nouveau démarre avec son seul président", async () => {
    const ancien = (await m.requetes.mandatCourant())!;
    const [doc] = await m.docs.rechercherDocuments(com, { portee: "miens" });
    const [act] = await m.reqActivites.rechercherActivites(com, { texte: "rentrée" });
    await expect(m.cloture.cloreMandat(vice, { libelle: "2027-2028", nom: "Moussa", email: "moussa@esatic.edu.ci" })).rejects.toThrow(/président/);
    await expect(m.cloture.cloreMandat(president, { libelle: "2026-2027", nom: "Moussa", email: "moussa@esatic.edu.ci" })).rejects.toThrow(/autre nom/);
    const r = await m.cloture.cloreMandat(president, { libelle: "2027-2028", nom: "Moussa Traoré", email: "Moussa@esatic.edu.ci" });
    expect(r.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.clos).toBe("2026-2027");
    // L'ancien président n'a plus de rôle : il ne clôt pas le nouveau mandat.
    await expect(m.cloture.cloreMandat(await acteur(president.id), { libelle: "2028-2029", nom: "X", email: "x@esatic.edu.ci" })).rejects.toThrow(/président/);

    const nouveau = (await m.requetes.mandatCourant())!;
    expect(nouveau).toMatchObject({ libelle: "2027-2028" });
    expect((await m.requetes.membresDuMandat(nouveau.id)).map((x) => [x.nom, x.role])).toEqual([["Moussa Traoré", "president"]]);
    const moussa = await acteur((await m.requetes.membresDuMandat(nouveau.id))[0]!.userId);
    const anciensMembres = { com: await acteur(com.id), president: await acteur(president.id) };
    expect(anciensMembres.com.affectation).toBeNull();

    // Lecture seule pour tous ; le nouveau bureau lit tout, l'auteur garde la lecture de ses documents.
    const lu = (await m.docs.documentLisible(doc!.id, moussa))!;
    expect(lu.d.fige).toBe(true);
    await expect(m.modifier.modifierDocument(moussa, doc!.id, { titre: "Nouveau titre" })).rejects.toThrow(/introuvable/);
    expect(await m.docs.documentLisible(doc!.id, anciensMembres.com)).not.toBeNull();
    await expect(m.activites.modifierActivite(moussa, act!.id, { titre: "x", date: "2026-11-14" })).rejects.toThrow(/lecture seule/);
    await expect(m.passation.ecrireNote(moussa, communication, "x")).resolves.toBeUndefined(); // note du nouveau mandat
    expect((await m.passation.dossierPassation(moussa, ancien.id, communication))!.note).toBe("Relancer l'imprimeur pour la facture.");
  });

  it("archives : mandat passé créé pour l'import, rangé après le mandat en cours", async () => {
    const moussa = await acteur((await m.requetes.membresDuMandat((await m.requetes.mandatCourant())!.id))[0]!.userId);
    await expect(m.archives.creerMandatPasse(await acteur(com.id), "2023-2024")).rejects.toThrow(/bureau/);
    const passe = await m.archives.creerMandatPasse(moussa, "2023-2024");
    expect(await m.archives.creerMandatPasse(moussa, " 2023-2024 ")).toBe(passe);
    const r = await m.archives.mandatPourImport(moussa, passe, communication);
    const { id } = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "pv-ag-2023.pdf", titre: "PV de l'AG 2023", visibilite: "section" }, moussa.id, r);
    expect((await m.docs.documentLisible(id, moussa))!.d).toMatchObject({ mandatId: passe, delegationId: communication, fige: true });
    const section = (await m.requetes.mandatCourant())!.sectionId;
    expect((await m.archives.mandatsDeLaSection(section)).map((x) => [x.libelle, x.statut])).toEqual([
      ["2027-2028", "en_cours"],
      ["2026-2027", "clos"],
      ["2023-2024", "clos"],
    ]);
    expect((await m.docs.rechercherDocuments(moussa, { texte: "AG", mandatId: passe })).map((d) => d.titre)).toEqual(["PV de l'AG 2023"]);
  });
});
