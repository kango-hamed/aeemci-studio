/**
 * Documents administratifs (lot 4) contre Postgres et Chromium : rédaction, circuit de validation,
 * numérotation sans trou par délégation, type et année, signatures et cachet, intérim, nouvelle version.
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
import { htmlDocument, heureSaisie, dateSaisie } from "@/fonctionnalites/administratif/mise-en-page";
import { controlerContenu, definitionType } from "@/fonctionnalites/administratif/types";

const url = process.env.TEST_DATABASE_URL;
const IMAGE = fs.readFileSync(path.resolve(import.meta.dirname, "../public/sceau-aeemci.png"));
const LETTRE = { destinataire: "Monsieur le Directeur\nde l'ESATIC", objet: "Demande de salle", appel: "Monsieur le Directeur,", corps: "Nous avons l'honneur…" };
const PV = { reunion: "Réunion du bureau", date: "2026-10-10", debut: "15:00", lieu: "Salle B12", presents: "Awa\nMoussa", ordre: "Bilan\nProgramme", deroulement: "La séance est ouverte." };

describe("mise en page", () => {
  it("échappe la saisie, met le filigrane sur un projet, formate dates et heures", () => {
    const t = definitionType("COM")!;
    const html = htmlDocument({ type: t, contenu: { titre: "<b>Report</b>", corps: "Ligne 1\nLigne 2\n\nParagraphe" }, numero: null, date: new Date("2026-11-01T10:00:00Z"), section: "ESATIC", signatures: [{ titre: "Le Président", nom: "" }], projet: true });
    expect(html).toContain("&lt;b&gt;Report&lt;/b&gt;");
    expect(html).toContain("<p>Ligne 1<br>Ligne 2</p><p>Paragraphe</p>");
    expect(html).toContain('class="filigrane"');
    expect(html).toContain("Abidjan, le 1er novembre 2026");
    expect(html).toContain("attribué à la validation");
    expect(dateSaisie("2026-10-10")).toBe("samedi 10 octobre 2026");
    expect(heureSaisie("15:00")).toBe("15 h");
    expect(heureSaisie("09:30")).toBe("9 h 30");
  });

  it("contrôle les champs requis et les dates d'un ordre de mission", () => {
    const om = definitionType("OM")!;
    const erreurs = controlerContenu(om, { missionnaire: "Awa", fonction: "SG", destination: "Bouaké", objet: "Congrès", depart: "2026-11-10", retour: "2026-11-08" });
    expect(erreurs.map((e) => e.champ)).toEqual(["retour"]);
    expect(controlerContenu(om, {}).length).toBe(6);
  });
});

describe.skipIf(!url)("documents administratifs (Postgres + Chromium)", () => {
  let m: {
    circuit: typeof import("@/fonctionnalites/administratif/circuit");
    signatures: typeof import("@/fonctionnalites/administratif/signatures");
    docs: typeof import("@/fonctionnalites/documents/requetes");
    gestion: typeof import("@/fonctionnalites/organisation/gestion");
    requetes: typeof import("@/fonctionnalites/organisation/requetes");
    stockage: typeof import("@/serveur/stockage");
  };
  const dossierStockage = fs.mkdtempSync(path.join(os.tmpdir(), "aeemci-administratif-test-"));
  let president: Acteur;
  let vice: Acteur;
  let secretaire: Acteur;
  let com1: Acteur;
  let com2: Acteur;
  let communication: string;
  const annee = new Date().getUTCFullYear();

  async function acteur(userId: string): Promise<Acteur> {
    const a = await m.requetes.affectationCourante(userId);
    return { id: userId, estAdministrateur: false, affectation: a && { role: a.role, delegationId: a.delegationId } };
  }
  const rattachement = async (u: Acteur) => ({ mandatId: (await m.requetes.mandatCourant())!.id, delegationId: u.affectation?.delegationId ?? null });
  const rediger = async (u: Acteur, type: string, contenu: Record<string, string>) => (await m.circuit.enregistrerRedaction(u, { type, contenu }, await rattachement(u))).id;
  const lire = async (id: string, u: Acteur = president) => (await m.docs.documentLisible(id, u))?.d;

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
      circuit: await import("@/fonctionnalites/administratif/circuit"),
      signatures: await import("@/fonctionnalites/administratif/signatures"),
      docs: await import("@/fonctionnalites/documents/requetes"),
      gestion: await import("@/fonctionnalites/organisation/gestion"),
      requetes: await import("@/fonctionnalites/organisation/requetes"),
      stockage: await import("@/serveur/stockage"),
    };
    president = await acteur(userId);
    communication = await m.gestion.creerDelegation(president, "Cellule communication");
    const ajouter = async (email: string, role: "membre" | "vice_president" | "secretaire_general", delegationId: string | null = null) =>
      acteur((await m.gestion.ajouterMembre(president, { nom: email.split("@")[0]!, email, role, delegationId })).userId);
    vice = await ajouter("vice@esatic.edu.ci", "vice_president");
    secretaire = await ajouter("sg@esatic.edu.ci", "secretaire_general");
    com1 = await ajouter("com1@esatic.edu.ci", "membre", communication);
    com2 = await ajouter("com2@esatic.edu.ci", "membre", communication);
  });

  afterAll(() => fs.rmSync(dossierStockage, { recursive: true, force: true }));

  it("rédige un projet PDF, invisible hors de l'auteur et du bureau jusqu'à la validation", async () => {
    const id = await rediger(com1, "LET", { objet: "Demande de salle" });
    const d = (await lire(id, com1))!;
    expect(d).toMatchObject({ origine: "redige", statut: "brouillon", etatValidation: "redaction", typeAdministratif: "LET", type: "application/pdf", titre: "Lettre · Demande de salle", numero: null });
    expect((await m.stockage.stockage().lire(d.fichier))?.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await m.stockage.stockage().lire(d.miniature!))?.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(await lire(id, com2)).toBeUndefined();
    expect(await lire(id, president)).toBeDefined();
  });

  it("refuse la soumission d'un document incomplet, puis le fige une fois soumis", async () => {
    const id = await rediger(com1, "LET", { objet: "Incomplet" });
    await expect(m.circuit.soumettre(com1, id)).rejects.toMatchObject({ erreurs: expect.arrayContaining([expect.objectContaining({ champ: "corps" })]) });
    await m.circuit.enregistrerRedaction(com1, { id, type: "LET", contenu: LETTRE }, await rattachement(com1));
    await m.circuit.soumettre(com1, id);
    expect((await lire(id))!.etatValidation).toBe("soumis");
    await expect(m.circuit.enregistrerRedaction(com1, { id, type: "LET", contenu: LETTRE }, await rattachement(com1))).rejects.toThrow(/attend la validation/);
    await expect(m.circuit.soumettre(com2, id)).rejects.toThrow(/introuvable/);
  });

  it("valide : signature, cachet et code de délégation exigés ; numéros sans trou ; publication", async () => {
    const a = await rediger(com1, "LET", LETTRE);
    await m.circuit.soumettre(com1, a);
    await expect(m.circuit.valider(vice, a)).rejects.toThrow(/intérim/);
    await expect(m.circuit.valider(com2, a)).rejects.toThrow(/Seul le président/);
    await expect(m.circuit.valider(president, a)).rejects.toThrow(/ta signature/);
    await m.signatures.enregistrerSignature(president, IMAGE);
    await expect(m.circuit.valider(president, a)).rejects.toThrow(/cachet/);
    await expect(m.signatures.enregistrerCachet(vice, IMAGE)).rejects.toThrow(/président/);
    await m.signatures.enregistrerCachet(president, IMAGE);
    await expect(m.circuit.valider(president, a)).rejects.toThrow(/n'a pas encore de code/);
    await expect(m.gestion.renommerDelegation(president, communication, "Cellule communication", "BE")).rejects.toThrow(/bureau exécutif/);
    await m.gestion.renommerDelegation(president, communication, "Cellule communication", "com");

    const { numero } = await m.circuit.valider(president, a);
    expect(numero).toBe(`AEEMCI-ESATIC/COM/LET/${annee}/001`);
    const d = (await lire(a, com2))!;
    expect(d).toMatchObject({ etatValidation: "valide", statut: "publie", numero, valideParId: president.id, signataires: [{ role: "president", userId: president.id, nom: "Awa Koné" }] });
    expect(d.fichier).toBe(`documents/${a}/valide.pdf`);
    await expect(m.circuit.valider(president, a)).rejects.toThrow(/n'attend pas/);

    // Le premier document, soumis au test précédent, prend le numéro suivant ; un autre type repart à 1.
    const [precedent] = await m.docs.rechercherDocuments(president, { etats: ["soumis"] });
    expect((await m.circuit.valider(president, precedent!.id)).numero).toBe(`AEEMCI-ESATIC/COM/LET/${annee}/002`);
    const att = await rediger(com1, "ATT", { beneficiaire: "Moussa", objet: "a été membre actif." });
    await m.circuit.soumettre(com1, att);
    expect((await m.circuit.valider(president, att)).numero).toBe(`AEEMCI-ESATIC/COM/ATT/${annee}/001`);
  });

  it("procès-verbal : signé par le secrétaire de séance (son auteur) et le président, numéroté au bureau", async () => {
    const id = await rediger(secretaire, "PV", PV);
    await expect(m.circuit.soumettre(secretaire, id)).rejects.toThrow(/secrétaire de séance/);
    await m.signatures.enregistrerSignature(secretaire, IMAGE);
    await m.circuit.soumettre(secretaire, id);
    const { numero } = await m.circuit.valider(president, id);
    expect(numero).toBe(`AEEMCI-ESATIC/BE/PV/${annee}/001`);
    expect((await lire(id))!.signataires!.map((s) => s.role)).toEqual(["secretaire_seance", "president"]);
  });

  it("correction demandée avec un commentaire, puis resoumission ; historique du circuit", async () => {
    const id = await rediger(com1, "COM", { titre: "Report", corps: "La journée est reportée." });
    await m.circuit.soumettre(com1, id);
    await expect(m.circuit.demanderCorrection(president, id, "  ")).rejects.toThrow(/corriger/);
    await m.circuit.demanderCorrection(president, id, "Préciser la nouvelle date.");
    expect((await lire(id))!.etatValidation).toBe("a_corriger");
    await m.circuit.enregistrerRedaction(com1, { id, type: "COM", contenu: { titre: "Report", corps: "Reportée au 14 novembre." } }, await rattachement(com1));
    await m.circuit.soumettre(com1, id);
    const h = await m.circuit.historique(id);
    expect(h.map((e) => e.action)).toEqual(["soumis", "correction_demandee", "soumis"]);
    expect(h[1]).toMatchObject({ commentaire: "Préciser la nouvelle date.", acteur: "Awa Koné" });
  });

  it("intérim : le vice-président valide et signe à la place du président", async () => {
    const id = await rediger(com1, "COM", { titre: "Intérim", corps: "Texte." });
    await m.circuit.soumettre(com1, id);
    await expect(m.signatures.changerInterim(vice, true)).rejects.toThrow(/président/);
    await m.signatures.changerInterim(president, true);
    await m.signatures.enregistrerSignature(vice, IMAGE);
    await m.circuit.valider(vice, id);
    expect((await lire(id))!.signataires).toEqual([expect.objectContaining({ role: "interim", userId: vice.id })]);
    await m.signatures.changerInterim(president, false);
  });

  it("un document validé reste figé : sa correction est une nouvelle version qui refait le circuit", async () => {
    const [valide] = await m.docs.rechercherDocuments(president, { etats: ["valide"], origine: "redige" });
    await expect(m.circuit.enregistrerRedaction(president, { id: valide!.id, type: "LET", contenu: LETTRE }, await rattachement(president))).rejects.toThrow(/nouvelle version/);
    const { id } = await m.circuit.nouvelleVersion(president, valide!.id, await rattachement(president));
    const d = (await lire(id))!;
    expect(d).toMatchObject({ versionDeId: valide!.id, etatValidation: "redaction", statut: "brouillon", numero: null, titre: valide!.titre });
    expect(await m.circuit.versionSuivante(valide!.id)).toBe(id);
    expect((await lire(valide!.id))!.etatValidation).toBe("valide");
  });
});
