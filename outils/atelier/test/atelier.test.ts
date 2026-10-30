import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CataloguePolices, type Gabarit } from "../../../packages/moteur/src/index.ts";
import { controlerGabarit, PHOTO_ESSAI, valeursEssai } from "../src/controles.ts";
import { demarrerAtelier, FICHIER_PUBLIE } from "../src/serveur.ts";

const EX = path.resolve(import.meta.dirname, "../../../packages/moteur/exemples");
const polices = CataloguePolices.depuisFichier(path.join(EX, "polices/polices.json"));
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "atelier-"));
for (const f of fs.readdirSync(path.join(EX, "membre-retenu"))) fs.copyFileSync(path.join(EX, "membre-retenu", f), path.join(dossier, f));
const gabarit = (): Gabarit => JSON.parse(fs.readFileSync(path.join(dossier, "manifest.json"), "utf8")).gabarit;

describe("contrôles avant publication", () => {
  it("bloque ce qui empêcherait de produire le document, signale ce qui est à relire", () => {
    expect(controlerGabarit(gabarit(), polices, dossier)).toEqual({ bloquants: [], remarques: [] });
    const g = gabarit();
    g.champs[0].libelle = "Nom et prénom"; // = texte d'exemple du PSD
    g.champs[1].libelle = "";
    g.plans[0].zones[1].debordement = { mode: "reduire", taille_min_px: 999 };
    g.plans[0].fond = "absent.png";
    const r = controlerGabarit(g, new CataloguePolices([]), dossier);
    expect(r.bloquants).toEqual([
      "Champ « photo » : libellé vide.",
      "Plan « membre-retenu » : fond introuvable (absent.png).",
      "Plan « membre-retenu », zone « nom » : taille minimale supérieure à la taille d'origine.",
      "Police « Outfit-Regular » non installée sur le serveur de rendu.",
    ]);
    expect(r.remarques).toEqual([
      "Champ « nom » : le libellé « Nom et prénom » ressemble à une valeur d'exemple ; écris plutôt la question posée (ex. « Nom du panéliste »).",
    ]);
  });

  it("prépare des valeurs d'essai : exemple du PSD, puis cas le plus long", () => {
    expect(valeursEssai(gabarit(), "exemple")).toEqual({ nom: "Nom et prénom", photo: PHOTO_ESSAI });
    const long = valeursEssai(gabarit(), "long").nom as string;
    expect(long.length).toBe(40); // max_caracteres
    expect(long.startsWith("Nom et prénom Nom")).toBe(true);
  });
});

describe("serveur de l'atelier", () => {
  let atelier: Awaited<ReturnType<typeof demarrerAtelier>>;
  beforeAll(async () => {
    atelier = await demarrerAtelier({ dossier, polices, port: 0 });
  });
  afterAll(async () => {
    await atelier?.fermer();
  });

  it("donne l'état, rend un aperçu et refuse les valeurs invalides", async () => {
    const etat = await (await fetch(`${atelier.url}api/etat`)).json();
    expect(etat).toMatchObject({ nom: "membre-retenu", revision: 0, controles: { bloquants: [] } });
    const ok = await fetch(`${atelier.url}api/apercu`, { method: "POST", body: JSON.stringify({ gabarit: etat.gabarit, valeurs: { nom: "Awa", photo: PHOTO_ESSAI }, largeur: 400 }) });
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(JSON.parse(Buffer.from(ok.headers.get("x-rapport")!, "base64").toString("utf8"))).toContainEqual(expect.objectContaining({ champ: "nom", texte: "Awa" }));
    const ko = await fetch(`${atelier.url}api/apercu`, { method: "POST", body: JSON.stringify({ gabarit: etat.gabarit, valeurs: { nom: "" } }) });
    expect(ko.status).toBe(422);
    expect((await ko.json()).erreurs.map((e: { champ: string }) => e.champ)).toEqual(["nom", "photo"]);
  });

  it("publie une révision, sans toucher au manifest du plugin", async () => {
    const avant = fs.readFileSync(path.join(dossier, "manifest.json"), "utf8");
    const g = gabarit();
    g.champs[0].libelle = "Nom du membre retenu";
    g.champs[0].aide = "Tel qu'il doit apparaître sur l'affiche";
    const r1 = await (await fetch(`${atelier.url}api/publier`, { method: "POST", body: JSON.stringify({ gabarit: g, nom: "Membre retenu AGO", description: "Affiche d'annonce d'un membre retenu" }) })).json();
    expect(r1.revision).toBe(1);
    const r2 = await (await fetch(`${atelier.url}api/publier`, { method: "POST", body: JSON.stringify({ gabarit: g, nom: "Membre retenu AGO" }) })).json();
    expect(r2.revision).toBe(2);
    const publie = JSON.parse(fs.readFileSync(path.join(dossier, FICHIER_PUBLIE), "utf8"));
    expect(publie).toMatchObject({ format: "aeemci-studio/gabarit-publie", revision: 2, nom: "Membre retenu AGO", gabarit: { champs: [{ libelle: "Nom du membre retenu", aide: "Tel qu'il doit apparaître sur l'affiche" }, {}] } });
    expect(fs.readFileSync(path.join(dossier, "manifest.json"), "utf8")).toBe(avant);
    // Rouvert, l'atelier repart de la dernière publication.
    expect(await (await fetch(`${atelier.url}api/etat`)).json()).toMatchObject({ nom: "Membre retenu AGO", revision: 2 });
    // Publication refusée tant qu'un point bloque.
    g.champs[1].libelle = "";
    const refus = await fetch(`${atelier.url}api/publier`, { method: "POST", body: JSON.stringify({ gabarit: g }) });
    expect(refus.status).toBe(422);
  });
});
