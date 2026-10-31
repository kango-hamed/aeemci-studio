/**
 * Chaîne de génération contre Postgres et Chromium : import d'un gabarit publié, photo, aperçu,
 * création, droits de lecture, haute définition. Base jetable dans TEST_DATABASE_URL.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrer } from "../scripts/migrer.ts";
import { creerAdmin } from "../scripts/creer-admin.ts";

const url = process.env.TEST_DATABASE_URL;
const EX = path.resolve(import.meta.dirname, "../../../packages/moteur/exemples/membre-retenu");

function dossierPublie(nom = "Membre retenu") {
  const manifest = JSON.parse(fs.readFileSync(path.join(EX, "manifest.json"), "utf8"));
  const publication = { format: "aeemci-studio/gabarit-publie", revision: 1, publie_le: new Date().toISOString(), nom, source: { manifest: "manifest.json" }, gabarit: manifest.gabarit };
  return new Map<string, Buffer>([
    ["membre-retenu/gabarit.publie.json", Buffer.from(JSON.stringify(publication))],
    ["membre-retenu/manifest.json", fs.readFileSync(path.join(EX, "manifest.json"))],
    ["membre-retenu/fond-membre-retenu.png", fs.readFileSync(path.join(EX, "fond-membre-retenu.png"))],
  ]);
}

function estPng(b: Buffer) {
  return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

describe.skipIf(!url)("génération (Postgres + Chromium)", () => {
  let m: {
    importer: typeof import("@/fonctionnalites/gabarits/importer");
    gabarits: typeof import("@/fonctionnalites/gabarits/requetes");
    creer: typeof import("@/fonctionnalites/documents/creer");
    docs: typeof import("@/fonctionnalites/documents/requetes");
    db: typeof import("@/serveur/db");
    stockage: typeof import("@/serveur/stockage");
  };
  let admin: string;
  let membre: string;
  const dossierStockage = fs.mkdtempSync(path.join(os.tmpdir(), "aeemci-stockage-test-"));

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await c.end();
    await migrer(url!);
    admin = (await creerAdmin(url!, { email: "admin@esatic.edu.ci", nom: "Admin Test", motDePasse: "mot-de-passe-solide" })).userId;
    process.env.DATABASE_URL = url;
    process.env.STOCKAGE_DOSSIER = dossierStockage;
    m = {
      importer: await import("@/fonctionnalites/gabarits/importer"),
      gabarits: await import("@/fonctionnalites/gabarits/requetes"),
      creer: await import("@/fonctionnalites/documents/creer"),
      docs: await import("@/fonctionnalites/documents/requetes"),
      db: await import("@/serveur/db"),
      stockage: await import("@/serveur/stockage"),
    };
    membre = "membre-test";
    await m.db.db.insert(m.db.schema.user).values({ id: membre, name: "Awa Koné", email: "awa@esatic.edu.ci" });
  });

  afterAll(() => fs.rmSync(dossierStockage, { recursive: true, force: true }));

  it("refuse un dossier qui ne vient pas du plugin", async () => {
    const f = dossierPublie();
    f.delete("membre-retenu/gabarit.publie.json");
    f.delete("membre-retenu/manifest.json");
    await expect(m.importer.importerGabarit(f, admin)).rejects.toThrow(/manifest\.json/);
  });

  it("refuse un gabarit dont le fond manque, avec la raison", async () => {
    const f = dossierPublie();
    f.delete("membre-retenu/fond-membre-retenu.png");
    await expect(m.importer.importerGabarit(f, admin)).rejects.toMatchObject({ details: [expect.stringMatching(/fond introuvable/)] });
  });

  let gabaritId: string;
  let revisionId: string;

  it("importe le gabarit, stocke ses fichiers et sa vignette", async () => {
    const r = await m.importer.importerGabarit(dossierPublie(), admin, { publier: true });
    expect(r).toMatchObject({ nom: "Membre retenu", numero: 1, nouveau: true });
    ({ gabaritId, revisionId } = r);
    const liste = await m.gabarits.gabaritsDisponibles({ id: admin, estAdministrateur: true, affectation: null });
    expect(liste).toEqual([expect.objectContaining({ id: gabaritId, revisionId, aVignette: true, largeur: 1080, hauteur: 1350 })]);
    const vignette = await m.stockage.stockage().lire(`gabarits/${gabaritId}/${revisionId}/vignette-${revisionId}.jpg`);
    expect(vignette?.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it("une nouvelle publication du même nom crée la révision 2", async () => {
    const r = await m.importer.importerGabarit(dossierPublie(), admin, { publier: true });
    expect(r).toMatchObject({ gabaritId, numero: 2, nouveau: false });
    revisionId = r.revisionId;
    expect((await m.gabarits.gabaritsDisponibles({ id: admin, estAdministrateur: true, affectation: null })).map((g) => g.numero)).toEqual([2]);
  });

  it("refuse un document fait sur une révision dépassée", async () => {
    const ancienne = (await m.db.db.select().from(m.db.schema.revisionGabarit)).find((r) => r.numero === 1)!.id;
    await expect(m.creer.creerDocument({ gabaritId, revisionId: ancienne, valeurs: { nom: "Awa" } }, membre)).rejects.toThrow(/mis à jour/);
  });

  it("refuse un document incomplet en nommant le champ", async () => {
    await expect(m.creer.creerDocument({ gabaritId, revisionId, valeurs: { nom: "" } }, membre)).rejects.toMatchObject({
      erreurs: expect.arrayContaining([expect.objectContaining({ champ: "nom" }), expect.objectContaining({ champ: "photo" })]),
    });
  });

  let documentId: string;

  it("crée le document avec la photo du membre, sans accepter celle d'un autre", async () => {
    const photo = fs.readFileSync(path.join(EX, "photo-test.jpg"));
    const ajouter = async (userId: string) => {
      const id = crypto.randomUUID();
      const cle = `televersements/${userId}/${id}.jpg`;
      await m.stockage.stockage().ecrire(cle, photo, "image/jpeg");
      await m.db.db.insert(m.db.schema.televersement).values({ id, userId, cle, type: "image/jpeg", taille: photo.length });
      return id;
    };
    const photoAdmin = await ajouter(admin);
    await expect(m.creer.creerDocument({ gabaritId, revisionId, valeurs: { nom: "Awa Koné", photo: `televersement:${photoAdmin}` } }, membre)).rejects.toMatchObject({
      erreurs: [expect.objectContaining({ champ: "photo" })],
    });

    const sienne = await ajouter(membre);
    ({ id: documentId } = await m.creer.creerDocument({ gabaritId, revisionId, valeurs: { nom: "Awa Koné", photo: `televersement:${sienne}`, inconnu: "ignoré" } }, membre));
    const [d] = await m.db.db.select().from(m.db.schema.document);
    expect(d).toMatchObject({ titre: "Membre retenu – Awa Koné", largeur: 1080, hauteur: 1350, valeurs: { nom: "Awa Koné", photo: `televersement:${sienne}` } });
    expect(estPng((await m.stockage.stockage().lire(d!.fichier))!)).toBe(true);
  });

  it("le document est lisible par son auteur et un administrateur, pas par un autre membre", async () => {
    const u = (id: string, estAdministrateur = false) => ({ id, nom: "x", email: "x", estAdministrateur, affectation: null });
    expect(await m.docs.documentLisible(documentId, u(membre))).not.toBeNull();
    expect(await m.docs.documentLisible(documentId, u(admin, true))).not.toBeNull();
    expect(await m.docs.documentLisible(documentId, u("quelqu-un"))).toBeNull();
    expect((await m.docs.documentsDe(u(membre))).map((d) => d.titre)).toEqual(["Membre retenu – Awa Koné"]);
  });

  it("refait le document en haute définition, à la taille du plan, et le garde", async () => {
    const l = (await m.docs.documentLisible(documentId, { id: membre, estAdministrateur: false, affectation: null }))!;
    const hd = await m.creer.fichierHauteDefinition(l.d, { id: l.revision!.id, prefixe: l.revision!.prefixe, contenu: l.revision!.contenu }, l.d.plan!);
    expect(hd.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(await m.stockage.stockage().lire(`documents/${documentId}/${l.d.plan}-hd.jpg`)).toEqual(hd);
  });

  it("gabarit d'impression : prépare un fond réduit pour l'aperçu et plafonne la haute définition", async () => {
    const { PNG } = await import("pngjs");
    const fond = new PNG({ width: 4000, height: 5000 });
    fond.data.fill(200);
    const gabarit = {
      version: "1.0",
      champs: [{ nom: "titre", type: "texte", libelle: "Titre", obligatoire: true }],
      plans: [
        {
          plan: "affiche",
          largeur_px: 4000,
          hauteur_px: 5000,
          fond: "gabarit/fond.png",
          zones: [{ champ: "titre", forme: "point", ancre: { x: 2000, ligne_de_base: 2500 }, largeur_max: 3600, texte: { nom_postscript: "Montserrat-Bold", taille_px: 200, alignement: "centre", couleur: "#185431" }, exemple: "Titre" }],
        },
      ],
    };
    const pub = { format: "aeemci-studio/gabarit-publie", revision: 1, nom: "Grande affiche", gabarit };
    const { rendre, LARGEUR_HD, LARGEUR_REDUITE } = await import("@/fonctionnalites/generation/rendu");
    const r = await m.importer.importerGabarit(new Map([["gabarit.publie.json", Buffer.from(JSON.stringify(pub))], ["gabarit/fond.png", PNG.sync.write(fond)]]), admin, { publier: true });
    const reduit = await m.stockage.stockage().lire(`gabarits/${r.gabaritId}/${r.revisionId}/reduit/gabarit/fond.png`);
    expect(PNG.sync.read(reduit!).width).toBe(LARGEUR_REDUITE);
    const revision = { id: r.revisionId, prefixe: `gabarits/${r.gabaritId}/${r.revisionId}`, contenu: gabarit as never };
    const apercu = await rendre({ revision, valeurs: { titre: "Bonjour" }, format: "png", largeurMax: 1080 });
    expect([apercu.largeur, apercu.hauteur]).toEqual([1080, 1350]);
    const hd = await rendre({ revision, valeurs: { titre: "Bonjour" }, format: "jpeg", hd: true });
    expect(hd.largeur).toBe(Math.min(LARGEUR_HD, 4000));
  }, 60000);
});
