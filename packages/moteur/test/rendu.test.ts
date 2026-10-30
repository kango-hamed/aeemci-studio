import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CataloguePolices, consignesDuPlan, ErreurRendu, LANCEMENT_CHROMIUM, rendrePlan, type Gabarit } from "../src/index.ts";

const EX = path.resolve(import.meta.dirname, "../exemples");
const charger = (nom: string) => JSON.parse(fs.readFileSync(path.join(EX, nom, "manifest.json"), "utf8")).gabarit as Gabarit;
const polices = CataloguePolices.depuisFichier(path.join(EX, "polices/polices.json"));
const membre = charger("membre-retenu");
const collecte = charger("collecte");

let navigateur: Browser;
beforeAll(async () => {
  navigateur = await chromium.launch(LANCEMENT_CHROMIUM);
});
afterAll(async () => {
  await navigateur?.close();
});

const rendreMembre = (valeurs: Record<string, string>, extra = {}) =>
  rendrePlan({ gabarit: membre, dossier: path.join(EX, "membre-retenu"), dossierImages: path.join(EX, "membre-retenu"), valeurs, polices, navigateur, ...extra });

/** Masque des pixels sombres (texte #2D2D2D sur fond orange) dans un rectangle. */
function masqueSombre(png: PNG, x0: number, y0: number, x1: number, y1: number, dx = 0, dy = 0): boolean[] {
  const m: boolean[] = [];
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = ((y + dy) * png.width + (x + dx)) * 4;
      m.push((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3 < 110);
    }
  return m;
}
const iou = (a: boolean[], b: boolean[]) => {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i] || b[i]) union++;
  }
  return union ? inter / union : 0;
};

describe("consignes (sans navigateur)", () => {
  it("traduit zones et valeurs : image résolue, jauge, modèle, zones vides ignorées", () => {
    const fichiers = new Map<string, string>();
    const c = consignesDuPlan(collecte, collecte.plans[0], { date: "2026-11-15", collecte: "1820000", progression: 1523950, message: "" }, fichiers);
    expect(c.map((k) => k.genre)).toEqual(["texte", "texte", "texte", "texte", "jauge"]);
    expect(c.filter((k) => k.genre === "texte").map((k) => k.genre === "texte" && k.texte)).toEqual(["Dim", "15", "Novembre 2026", "Collecté : 1 820 000 f CFA"]);
    expect(c[4]).toMatchObject({ genre: "jauge", ratio: 0.5, couleur: "#F29400" });
    const m = consignesDuPlan(membre, membre.plans[0], { nom: "Awa", photo: "photo-test.jpg" }, fichiers, "/donnees");
    expect(m[0]).toMatchObject({ genre: "image", x: 337, y: 606, largeur: 407, hauteur: 396, ajustement: "couvrir" });
    expect([...fichiers.values()]).toContain(path.resolve("/donnees", "photo-test.jpg"));
  });
});

describe("rendu (Chromium)", () => {
  it("empile zones et couches dans l'ordre de la pile, avec leur mode de fusion", async () => {
    // Couche : un voile rouge semi-transparent sur la zone du nom (comme la « tache plume » de panel.psd).
    const dossier = fs.mkdtempSync(path.join(import.meta.dirname, "tmp-"));
    try {
      for (const f of ["fond-membre-retenu.png", "photo-test.jpg"]) fs.copyFileSync(path.join(EX, "membre-retenu", f), path.join(dossier, f));
      const voile = new PNG({ width: 1080, height: 1350 });
      for (let y = 1060; y < 1160; y++)
        for (let x = 250; x < 830; x++) {
          const i = (y * 1080 + x) * 4;
          voile.data.set([255, 0, 0, 128], i);
        }
      fs.writeFileSync(path.join(dossier, "couche.png"), PNG.sync.write(voile));
      const pixel = (buf: Buffer, x: number, y: number) => {
        const p = PNG.sync.read(buf);
        return [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)];
      };
      // « N » de « Nom et prénom » : pixel plein du texte sombre (#2D2D2D).
      const xN = 300, yN = 1100;
      const g = (pileCouche: number, mode?: "multiply") => {
        const gab = structuredClone(membre);
        gab.plans[0].zones[0].pile = 8;
        gab.plans[0].zones[1].pile = 5;
        gab.plans[0].couches = [{ calque: "Voile", pile: pileCouche, fichier: "couche.png", ...(mode ? { mode } : {}) }];
        return rendrePlan({ gabarit: gab, dossier, dossierImages: dossier, valeurs: { nom: "Nom et prénom", photo: "photo-test.jpg" }, polices, navigateur });
      };
      const dessous = pixel((await g(10)).fichier, xN, yN); // couche sous les zones : texte intact
      expect(Math.max(...dessous)).toBeLessThan(70);
      const dessus = pixel((await g(2)).fichier, xN, yN); // couche au-dessus : voile rouge sur le texte
      expect(dessus[0]).toBeGreaterThan(dessus[1] + 60);
      const produit = pixel((await g(2, "multiply")).fichier, xN, yN); // produit : le sombre reste sombre
      expect(Math.max(...produit)).toBeLessThan(70);
    } finally {
      fs.rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("découpe la photo selon les coins arrondis du cadre", async () => {
    const arrondi = structuredClone(membre);
    arrondi.plans[0].zones[0].image = { ajustement: "couvrir", rayons: [80, 80, 80, 80] };
    const r = await rendrePlan({ gabarit: arrondi, dossier: path.join(EX, "membre-retenu"), dossierImages: path.join(EX, "membre-retenu"), valeurs: { nom: "Awa", photo: "photo-test.jpg" }, polices, navigateur });
    const png = PNG.sync.read(r.fichier);
    const pixel = (x: number, y: number) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
    // Coin du cadre (337, 606) : hors de l'arrondi → on voit le fond, pas la photo de test.
    const fond = PNG.sync.read(fs.readFileSync(path.join(EX, "membre-retenu/fond-membre-retenu.png")));
    const pixelFond = (x: number, y: number) => [...fond.data.subarray((y * fond.width + x) * 4, (y * fond.width + x) * 4 + 3)];
    pixel(342, 611).forEach((v, i) => expect(Math.abs(v - pixelFond(342, 611)[i])).toBeLessThan(6));
    // Centre du cadre : la photo.
    const [rr, , bb] = pixel(360, 640); // arrière-plan bleuté de la photo de test
    expect(bb).toBeGreaterThan(rr);
    // Avec un liseré intérieur rouge de 10 px : bord du cadre rouge, centre toujours la photo.
    arrondi.plans[0].zones[0].image = { ajustement: "couvrir", rayons: [80, 80, 80, 80], contour: { epaisseur: 10, couleur: "#FF0000", position: "interieur" } };
    const r2 = await rendrePlan({ gabarit: arrondi, dossier: path.join(EX, "membre-retenu"), dossierImages: path.join(EX, "membre-retenu"), valeurs: { nom: "Awa", photo: "photo-test.jpg" }, polices, navigateur });
    const p2 = PNG.sync.read(r2.fichier);
    const px2 = (x: number, y: number) => [...p2.data.subarray((y * p2.width + x) * 4, (y * p2.width + x) * 4 + 3)];
    expect(px2(540, 610)).toEqual([255, 0, 0]); // 4 px sous le bord haut : dans le liseré
    expect(px2(540, 625)[2]).toBeGreaterThan(px2(540, 625)[0]); // 19 px : de nouveau la photo
    expect(bb).toBeGreaterThan(rr);
  });

  it("reproduit la typographie du PSD : le nom d'exemple recouvre l'original à plus de 90 %", async () => {
    const r = await rendreMembre({ nom: "Nom et prénom", photo: "photo-test.jpg" });
    const rendu = PNG.sync.read(r.fichier);
    const original = PNG.sync.read(fs.readFileSync(path.join(import.meta.dirname, "fixtures/original-membre-retenu.png")));
    expect([rendu.width, rendu.height]).toEqual([1080, 1350]);
    const zone = [270, 1070, 810, 1150] as const;
    const reference = masqueSombre(original, ...zone);
    let meilleur = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) meilleur = Math.max(meilleur, iou(reference, masqueSombre(rendu, ...zone, dx, dy)));
    expect(meilleur).toBeGreaterThan(0.9);
    expect(iou(reference, masqueSombre(rendu, ...zone))).toBeGreaterThan(0.9); // sans recalage
  });

  it("réduit un nom trop long sans descendre sous la taille minimale", async () => {
    const r = await rendreMembre({ nom: "Aïcha Kouadio Bintou Ben Abdallah Traoré", photo: "photo-test.jpg" });
    const nom = r.rapport.find((z) => z.champ === "nom")!;
    expect(nom.reduit).toBe(true);
    expect(nom.taille).toBeGreaterThanOrEqual(34.39);
    expect(nom.taille).toBeLessThan(62.52);
    expect(nom.depasse).toBe(false);
  });

  it("pose le texte saisi comme du texte, jamais comme du HTML", async () => {
    const piege = `<img src=x onerror="document.title='pirate'">`;
    const r = await rendreMembre({ nom: piege, photo: "photo-test.jpg" }, { gabarit: { ...membre, champs: membre.champs.map((c) => (c.nom === "nom" ? { ...c, max_caracteres: 100 } : c)) } });
    expect(r.rapport.find((z) => z.champ === "nom")!.texte).toBe(piege);
  });

  it("produit aussi un PDF et une sortie réduite pour les réseaux", async () => {
    const pdf = await rendreMembre({ nom: "Awa", photo: "photo-test.jpg" }, { format: "pdf" });
    expect(pdf.fichier.subarray(0, 5).toString()).toBe("%PDF-");
    const petit = await rendreMembre({ nom: "Awa", photo: "photo-test.jpg" }, { largeurSortie: 540 });
    const png = PNG.sync.read(petit.fichier);
    expect([png.width, png.height]).toEqual([540, 675]);
  });

  it("paragraphe : découpe en lignes dans le cadre ; coupe avec « … » si demandé", async () => {
    const long = "Grâce à votre générosité, offrons aux étudiants un Ramadan serein. ".repeat(6);
    const base = { gabarit: collecte, dossier: path.join(EX, "collecte"), polices, navigateur, valeurs: { date: "2026-11-15", collecte: 1000, progression: 10, message: long } };
    const reduit = (await rendrePlan(base)).rapport.find((z) => z.champ === "message")!;
    expect(reduit.lignes).toBeGreaterThan(3);
    expect(reduit.depasse).toBe(false);
    const coupe = structuredClone(collecte);
    coupe.plans[0].zones[5].debordement = { mode: "couper" };
    const r = (await rendrePlan({ ...base, gabarit: coupe })).rapport.find((z) => z.champ === "message")!;
    expect(r.coupe).toBe(true);
    expect(r.texte!.endsWith("…")).toBe(true);
    expect(r.depasse).toBe(false);
  });

  it("refuse de rendre avec des valeurs invalides ou une police non installée", async () => {
    await expect(rendreMembre({ nom: "", photo: "photo-test.jpg" })).rejects.toThrow(ErreurRendu);
    await expect(rendreMembre({ nom: "x".repeat(41), photo: "photo-test.jpg" })).resolves.toBeTruthy(); // « réduire » : pas de refus
    const sansPolice = new CataloguePolices([]);
    await expect(rendreMembre({ nom: "Awa", photo: "photo-test.jpg" }, { polices: sansPolice })).rejects.toThrow("Polices non installées sur le serveur de rendu : Outfit-Regular.");
  });
});
