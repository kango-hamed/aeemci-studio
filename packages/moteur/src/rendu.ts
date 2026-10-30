/**
 * Rendu d'un plan de gabarit : fond + zones dynamiques → PNG ou PDF, via Chromium (Playwright).
 * Les fichiers (fond, images saisies, polices) sont servis par une origine fictive interceptée,
 * jamais injectés dans le HTML : le texte saisi est posé avec textContent (pas d'injection).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { CataloguePolices } from "./polices.ts";
import { miseEnPage, type Consigne, type RapportZone } from "./mise-en-page.ts";
import { lireNombre, texteDeZone, validerValeurs, type ErreurChamp } from "./valeurs.ts";
import type { Couche, Gabarit, Plan, Valeurs, Zone } from "./types.ts";

const ORIGINE = "https://rendu.aeemci.local";
const TYPES_MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf" };

export class ErreurRendu extends Error {
  readonly erreurs: ErreurChamp[];
  constructor(message: string, erreurs: ErreurChamp[] = []) {
    super(message);
    this.erreurs = erreurs;
  }
}

export interface OptionsRendu {
  gabarit: Gabarit;
  /** Dossier du manifest : les chemins `fond` y sont relatifs. */
  dossier: string;
  valeurs: Valeurs;
  polices: CataloguePolices;
  /** Nom du plan à rendre (défaut : le premier). */
  plan?: string;
  format?: "png" | "jpeg" | "pdf";
  /** Largeur de sortie en px (défaut : celle du plan). Les fichiers d'impression (5400 px) se réduisent ainsi pour les réseaux. */
  largeurSortie?: number;
  /** Dossier de référence des images saisies données par chemin relatif (défaut : dossier courant). */
  dossierImages?: string;
  /** Navigateur partagé entre plusieurs rendus (sinon lancé puis fermé). */
  navigateur?: Browser;
}

export interface ResultatRendu {
  plan: string;
  fichier: Buffer;
  type: string;
  largeur: number;
  hauteur: number;
  rapport: RapportZone[];
}

/** Traduit les zones d'un plan en consignes de mise en page. Exporté pour les tests. */
export function consignesDuPlan(gabarit: Gabarit, plan: Plan, valeurs: Valeurs, fichiers: Map<string, string>, dossierImages = process.cwd(), dossierFond = dossierImages): Consigne[] {
  const champs = new Map(gabarit.champs.map((c) => [c.nom, c]));
  // Empilement : zones et couches dans l'ordre de la pile Photoshop, du bas (pile élevée) vers le haut.
  // Sans position (manifest ancien), une zone reste au-dessus du fond, dans l'ordre du manifest.
  const elements: { pile: number; rang: number; zone?: Zone; couche?: Couche }[] = [
    ...plan.zones.map((zone, rang) => ({ pile: zone.pile ?? -1, rang, zone })),
    ...(plan.couches ?? []).map((couche, rang) => ({ pile: couche.pile, rang: plan.zones.length + rang, couche })),
  ];
  const avecPile = elements.every((e) => e.zone?.pile !== undefined || e.couche);
  if (avecPile) elements.sort((a, b) => b.pile - a.pile || a.rang - b.rang);
  else elements.sort((a, b) => (a.couche ? 1 : 0) - (b.couche ? 1 : 0) || a.rang - b.rang);
  const consignes: Consigne[] = [];
  for (const el of elements) {
    if (el.couche) {
      consignes.push({ genre: "couche", champ: el.couche.calque ?? "couche", url: servir(fichiers, path.resolve(dossierFond, el.couche.fichier)), largeur: plan.largeur_px, hauteur: plan.hauteur_px, mode: el.couche.mode ?? "normal" });
      continue;
    }
    const z = el.zone!;
    const champ = champs.get(z.champ);
    if (!champ) continue;
    const v = valeurs[z.champ];
    if (champ.type === "image") {
      if (!z.cadre || v === null || v === undefined || v === "") continue;
      const url = String(v).startsWith("data:") ? String(v) : servir(fichiers, path.resolve(dossierImages, String(v)));
      consignes.push({ genre: "image", champ: z.champ, url, ...z.cadre, ajustement: z.image?.ajustement === "contenir" ? "contenir" : "couvrir", ...(z.image?.rayons ? { rayons: z.image.rayons } : {}), ...(z.image?.contour ? { contour: z.image.contour } : {}) });
      continue;
    }
    if (champ.type === "jauge") {
      if (!z.cadre) continue;
      const n = lireNombre(v) ?? 0;
      const min = z.jauge?.min ?? champ.min ?? 0;
      const max = z.jauge?.max ?? champ.max ?? 100;
      consignes.push({ genre: "jauge", champ: z.champ, ...z.cadre, ratio: max === min ? 0 : (n - min) / (max - min), sens: z.jauge?.sens === "vertical" ? "vertical" : "horizontal", couleur: z.jauge?.couleur || "#1A6012" });
      continue;
    }
    const st = z.texte;
    if (!st) continue;
    const texte = texteDeZone(z, champ, v);
    if (!texte) continue;
    const box = z.forme === "box" && z.cadre;
    consignes.push({
      genre: "texte",
      champ: z.champ,
      texte,
      police: CataloguePolices.alias(st.nom_postscript || "inconnue"),
      forme: box ? "box" : "point",
      x: box ? z.cadre!.x : z.ancre?.x ?? 0,
      y: box ? z.cadre!.y : z.ancre?.ligne_de_base ?? 0,
      largeur: box ? z.cadre!.largeur : z.largeur_max ?? plan.largeur_px,
      ...(box ? { hauteur: z.cadre!.hauteur } : {}),
      taille: st.taille_px,
      tailleMin: z.debordement?.taille_min_px ?? st.taille_px * 0.55,
      ...(st.interlignage_px ? { interlignage: st.interlignage_px } : {}),
      approcheEm: st.approche_em ?? 0,
      fauxGras: Boolean(st.faux_gras),
      couleur: st.couleur || "#000000",
      alignement: st.alignement || "gauche",
      debordement: z.debordement?.mode || "reduire",
    });
  }
  return consignes;
}

/** Enregistre un fichier local à servir et renvoie son URL sur l'origine fictive. */
function servir(fichiers: Map<string, string>, chemin: string): string {
  const cle = `/f/${fichiers.size}${path.extname(chemin).toLowerCase()}`;
  fichiers.set(cle, chemin);
  return ORIGINE + cle;
}

export async function rendrePlan(o: OptionsRendu): Promise<ResultatRendu> {
  const erreurs = validerValeurs(o.gabarit, o.valeurs);
  if (erreurs.length) throw new ErreurRendu(`Valeurs invalides : ${erreurs.map((e) => e.message).join(" ")}`, erreurs);
  const plan = o.plan ? o.gabarit.plans.find((p) => p.plan === o.plan) : o.gabarit.plans[0];
  if (!plan) throw new ErreurRendu(`Plan « ${o.plan} » absent du gabarit.`);

  // Polices : toutes celles des zones texte de ce plan doivent être installées.
  const noms = plan.zones.map((z) => z.texte?.nom_postscript).filter((n): n is string => Boolean(n));
  const manquantes = o.polices.manquantes(noms);
  if (manquantes.length) throw new ErreurRendu(`Polices non installées sur le serveur de rendu : ${manquantes.join(", ")}.`);

  const fichiers = new Map<string, string>();
  const fontFaces = [...new Set(noms)].map((n) => {
    const p = o.polices.trouver(n)!;
    return `@font-face{font-family:'${CataloguePolices.alias(n)}';src:url('${servir(fichiers, p.fichier)}');font-display:block}`;
  });
  const fond = plan.fond ? servir(fichiers, path.resolve(o.dossier, plan.fond)) : null;
  if (plan.fond && !fs.existsSync(path.resolve(o.dossier, plan.fond))) throw new ErreurRendu(`Fond introuvable : ${plan.fond}`);
  for (const c of plan.couches ?? []) {
    if (!fs.existsSync(path.resolve(o.dossier, c.fichier))) throw new ErreurRendu(`Couche introuvable : ${c.fichier}`);
  }
  const consignes = consignesDuPlan(o.gabarit, plan, o.valeurs, fichiers, o.dossierImages, o.dossier);

  const W = plan.largeur_px;
  const H = plan.hauteur_px;
  const largeur = Math.round(o.largeurSortie ?? W);
  const hauteur = Math.round((largeur * H) / W);
  // Texte préchargé pour que document.fonts.ready attende bien chaque police.
  const precharge = [...new Set(noms)].map((n) => `<span style="font-family:'${CataloguePolices.alias(n)}'">Aa</span>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces.join("")}
html,body{margin:0;padding:0;background:#fff}#precharge{position:absolute;left:-9999px}svg{display:block}</style></head>
<body><div id="precharge">${precharge}</div><svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${W} ${H}">
${fond ? `<image href="${fond}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>` : `<rect width="${W}" height="${H}" fill="#fff"/>`}
<g id="zones"></g></svg></body></html>`;

  const navigateur = o.navigateur ?? (await chromium.launch());
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur } });
  try {
    await page.route(`${ORIGINE}/**`, async (route) => {
      const chemin = fichiers.get(new URL(route.request().url()).pathname);
      if (!chemin || !fs.existsSync(chemin)) return route.fulfill({ status: 404 });
      await route.fulfill({ status: 200, contentType: TYPES_MIME[path.extname(chemin).toLowerCase()] || "application/octet-stream", body: fs.readFileSync(chemin) });
    });
    await page.goto(`${ORIGINE}/`, { waitUntil: "commit" }).catch(() => undefined);
    await page.setContent(html, { waitUntil: "load" });
    const rapport = await page.evaluate(miseEnPage, consignes);
    const format = o.format ?? "png";
    const fichier =
      format === "pdf"
        ? await page.pdf({ width: `${largeur}px`, height: `${hauteur}px`, printBackground: true, pageRanges: "1" })
        : await page.screenshot({ type: format, clip: { x: 0, y: 0, width: largeur, height: hauteur }, ...(format === "jpeg" ? { quality: 92 } : {}) });
    return { plan: plan.plan, fichier, type: format === "pdf" ? "application/pdf" : `image/${format}`, largeur, hauteur, rapport };
  } finally {
    await page.close();
    if (!o.navigateur) await navigateur.close();
  }
}

/** Rend toutes les déclinaisons (plans) d'un gabarit avec les mêmes valeurs. */
export async function rendreTout(o: Omit<OptionsRendu, "plan">): Promise<ResultatRendu[]> {
  const navigateur = o.navigateur ?? (await chromium.launch());
  try {
    const res: ResultatRendu[] = [];
    for (const p of o.gabarit.plans) res.push(await rendrePlan({ ...o, plan: p.plan, navigateur }));
    return res;
  } finally {
    if (!o.navigateur) await navigateur.close();
  }
}
