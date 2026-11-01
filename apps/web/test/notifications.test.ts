/**
 * Notifications (lot 8b) contre Postgres : destinataires de chaque notification, choix des membres,
 * appareils oubliés quand le service ne les connaît plus, rappel de la veille envoyé une seule fois,
 * activités proposées pour un partage depuis la galerie. Le service Web Push est simulé.
 * Base jetable dans TEST_DATABASE_URL.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrer } from "../scripts/migrer.ts";
import { creerAdmin } from "../scripts/creer-admin.ts";
import type { Acteur } from "@/fonctionnalites/organisation/droits";

const envoyes = vi.hoisted(() => ({ liste: [] as { endpoint: string; titre: string }[], perimes: new Set<string>() }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (a: { endpoint: string }, charge: string) => {
      if (envoyes.perimes.has(a.endpoint)) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      envoyes.liste.push({ endpoint: a.endpoint, titre: JSON.parse(charge).titre });
    },
  },
}));

const url = process.env.TEST_DATABASE_URL;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe.skipIf(!url)("notifications (Postgres)", () => {
  let m: {
    ev: typeof import("@/fonctionnalites/notifications/evenements");
    gestion: typeof import("@/fonctionnalites/organisation/gestion");
    requetes: typeof import("@/fonctionnalites/organisation/requetes");
    signatures: typeof import("@/fonctionnalites/administratif/signatures");
    deposer: typeof import("@/fonctionnalites/documents/deposer");
    modifier: typeof import("@/fonctionnalites/documents/modifier");
    activites: typeof import("@/fonctionnalites/activites/gestion");
    reqActivites: typeof import("@/fonctionnalites/activites/requetes");
    db: typeof import("@/serveur/db");
  };
  const dossierStockage = fs.mkdtempSync(path.join(os.tmpdir(), "aeemci-notifications-test-"));
  let president: Acteur;
  let vice: Acteur;
  let sg: Acteur;
  let com: Acteur;
  let com2: Acteur;
  let culture: Acteur;

  async function acteur(userId: string): Promise<Acteur> {
    const a = await m.requetes.affectationCourante(userId);
    return { id: userId, estAdministrateur: false, affectation: a && { role: a.role, delegationId: a.delegationId } };
  }
  const rattachement = async (u: Acteur) => ({ mandatId: (await m.requetes.mandatCourant())!.id, delegationId: u.affectation?.delegationId ?? null });
  const appareil = (u: Acteur) => `https://push.exemple.test/${u.id}`;
  const recus = () => envoyes.liste.map((e) => e.endpoint).sort();
  const pour = (...us: Acteur[]) => us.map(appareil).sort();

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await c.end();
    await migrer(url!);
    const { userId } = await creerAdmin(url!, { email: "president@esatic.edu.ci", nom: "Awa Koné", motDePasse: "mot-de-passe-solide", role: "president", mandat: "2026-2027" });
    process.env.DATABASE_URL = url;
    process.env.STOCKAGE_DOSSIER = dossierStockage;
    process.env.VAPID_PUBLIQUE = "cle-publique-de-test";
    process.env.VAPID_PRIVEE = "cle-privee-de-test";
    m = {
      ev: await import("@/fonctionnalites/notifications/evenements"),
      gestion: await import("@/fonctionnalites/organisation/gestion"),
      requetes: await import("@/fonctionnalites/organisation/requetes"),
      signatures: await import("@/fonctionnalites/administratif/signatures"),
      deposer: await import("@/fonctionnalites/documents/deposer"),
      modifier: await import("@/fonctionnalites/documents/modifier"),
      activites: await import("@/fonctionnalites/activites/gestion"),
      reqActivites: await import("@/fonctionnalites/activites/requetes"),
      db: await import("@/serveur/db"),
    };
    president = await acteur(userId);
    const communication = await m.gestion.creerDelegation(president, "Cellule communication", "COM");
    const delegationCulture = await m.gestion.creerDelegation(president, "Délégation culturelle", "CUL");
    const ajouter = async (email: string, role: "membre" | "vice_president" | "secretaire_general", delegationId: string | null) =>
      acteur((await m.gestion.ajouterMembre(president, { nom: email.split("@")[0]!, email, role, delegationId })).userId);
    vice = await ajouter("vice@esatic.edu.ci", "vice_president", null);
    sg = await ajouter("sg@esatic.edu.ci", "secretaire_general", null);
    com = await ajouter("com@esatic.edu.ci", "membre", communication);
    com2 = await ajouter("com2@esatic.edu.ci", "membre", communication);
    culture = await ajouter("culture@esatic.edu.ci", "membre", delegationCulture);
    for (const u of [president, vice, sg, com, com2, culture])
      await m.db.db.insert(m.db.schema.abonnementNotification).values({ userId: u.id, endpoint: appareil(u), p256dh: "p256dh", auth: "auth" });
  });

  beforeEach(() => {
    envoyes.liste = [];
  });

  afterAll(() => {
    delete process.env.VAPID_PUBLIQUE;
    delete process.env.VAPID_PRIVEE;
    fs.rmSync(dossierStockage, { recursive: true, force: true });
  });

  it("document soumis : au président, au vice-président aussi pendant l'intérim", async () => {
    expect((await m.ev.valideurs()).sort()).toEqual([president.id]);
    await m.signatures.changerInterim(president, true);
    expect((await m.ev.valideurs()).sort()).toEqual([president.id, vice.id].sort());
    await m.signatures.changerInterim(president, false);
  });

  it("document publié : aux membres visés par sa visibilité, jamais à l'auteur", async () => {
    await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "pv.pdf", visibilite: "delegation" }, com.id, await rattachement(com));
    expect(recus()).toEqual(pour(com2));

    envoyes.liste = [];
    await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "note.pdf", visibilite: "section" }, com.id, await rattachement(com));
    expect(recus()).toEqual(pour(president, vice, sg, com2, culture));

    envoyes.liste = [];
    await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "bureau.pdf", visibilite: "bureau" }, culture.id, await rattachement(culture));
    expect(recus()).toEqual(pour(president, vice, sg));
  });

  it("brouillon : rien à la création, la notification part à la publication", async () => {
    const { id } = await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "projet.pdf", visibilite: "delegation", statut: "brouillon" }, com.id, await rattachement(com));
    expect(recus()).toEqual([]);
    await m.modifier.modifierDocument(com, id, { statut: "publie" });
    expect(recus()).toEqual(pour(com2));
  });

  it("photos d'une activité : pas de notification à chaque photo", async () => {
    const { id } = await m.activites.creerActivite(com, { titre: "Atelier affiches", date: "2026-11-20" });
    await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "photo.pdf", activiteId: id }, com.id, await rattachement(com));
    expect(recus()).toEqual([]);
  });

  it("respecte les choix du membre et oublie les appareils périmés", async () => {
    await m.db.db.insert(m.db.schema.preferenceNotification).values({ userId: com2.id, partage: false });
    envoyes.perimes.add(appareil(culture));
    await m.deposer.deposerDocument({ contenu: PDF, nomFichier: "annonce.pdf", visibilite: "section" }, com.id, await rattachement(com));
    expect(recus()).toEqual(pour(president, vice, sg));
    const restants = await m.db.db.select().from(m.db.schema.abonnementNotification);
    expect(restants.map((r) => r.userId)).not.toContain(culture.id);
  });

  it("rappel de la veille : aux membres visés et à l'auteur, une seule fois", async () => {
    const veille = new Date("2026-11-13T18:00:00Z");
    expect(m.ev.lendemain(veille)).toBe("2026-11-14");
    await m.activites.creerActivite(president, { titre: "Conférence de rentrée", date: "2026-11-14", heure: "15:00", visibilite: "bureau" });
    await m.activites.creerActivite(com, { titre: "Réunion com", date: "2026-11-14", visibilite: "delegation" });
    await m.activites.creerActivite(com, { titre: "Plus tard", date: "2026-11-30", visibilite: "section" });
    expect(await m.ev.envoyerRappels(veille)).toBe(2);
    expect(envoyes.liste.filter((e) => e.titre === "Demain : Conférence de rentrée").map((e) => e.endpoint).sort()).toEqual(pour(president, vice, sg));
    // com2 a refusé les partages, pas les rappels.
    expect(envoyes.liste.filter((e) => e.titre === "Demain : Réunion com").map((e) => e.endpoint).sort()).toEqual(pour(com, com2));
    envoyes.liste = [];
    expect(await m.ev.envoyerRappels(veille)).toBe(0);
    expect(recus()).toEqual([]);
  });

  it("partage depuis la galerie : activités où le membre peut ajouter des photos", async () => {
    const titres = async (u: Acteur) => (await m.reqActivites.activitesPourPhotos(u)).map((a) => a.titre).sort();
    expect(await titres(com)).toEqual(["Atelier affiches", "Plus tard", "Réunion com"]);
    expect(await titres(culture)).toEqual([]);
    expect(await titres(president)).toContain("Conférence de rentrée");
  });
});
