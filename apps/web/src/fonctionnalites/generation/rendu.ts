import "server-only";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CataloguePolices,
  chromium,
  LANCEMENT_CHROMIUM,
  rendreApercuDocument,
  rendreDocumentPdf,
  rendrePlan,
  type Browser,
  type Gabarit,
  type OptionsDocument,
  type ResultatRendu,
  type Valeurs,
} from "@aeemci-studio/moteur";
import { stockage } from "@/serveur/stockage";

/**
 * Rendu côté serveur par le moteur.
 * - Un seul Chromium par instance, lancé à la première demande et relancé s'il tombe.
 * - Rendus simultanés limités (`RENDUS_SIMULTANES`, défaut 2) : Chromium est gourmand en mémoire.
 *   Un rendu haute définition occupe toutes les places à lui seul.
 * - Fichiers d'une révision (fond, couches) copiés une fois du stockage vers un cache local.
 * - Mémoire : décoder un fond d'impression (5400 × 6414) coûte plus d'1 Go à Chromium, quelle que soit
 *   la taille de sortie. L'import prépare donc des copies réduites (`reduit/`, 1620 px de large au plus)
 *   pour l'aperçu, le fichier réseaux et les vignettes ; seule la haute définition lit les originaux,
 *   et sa largeur est plafonnée (`LARGEUR_HD`, défaut 3600 px : impression A4 et A3).
 */

const DOSSIER_CACHE = path.join(os.tmpdir(), "aeemci-rendu");

// ── Polices installées ─────────────────────────────────────────────────────────

let polices: CataloguePolices | null = null;

/** Catalogue `polices.json` du moteur : `POLICES_DOSSIER` (image Docker), sinon le dossier du dépôt. */
export function catalogue(): CataloguePolices {
  if (polices) return polices;
  const candidats = [process.env.POLICES_DOSSIER, path.resolve(/*turbopackIgnore: true*/ "../../packages/moteur/polices"), path.resolve(/*turbopackIgnore: true*/ "packages/moteur/polices")].filter(Boolean) as string[];
  const dossier = candidats.find((d) => existsSync(path.join(d, "polices.json")));
  if (!dossier) throw new Error(`Catalogue de polices introuvable (cherché dans : ${candidats.join(", ")}).`);
  polices = CataloguePolices.depuisFichier(path.join(dossier, "polices.json"));
  return polices;
}

// ── Navigateur partagé et file d'attente ───────────────────────────────────────

const etat = globalThis as unknown as { navigateurRendu?: Promise<Browser> };

async function navigateur(): Promise<Browser> {
  if (etat.navigateurRendu) {
    const b = await etat.navigateurRendu.catch(() => null);
    if (b?.isConnected()) return b;
  }
  etat.navigateurRendu = chromium.launch({ ...LANCEMENT_CHROMIUM, args: [...LANCEMENT_CHROMIUM.args, "--disable-dev-shm-usage"] });
  const b = await etat.navigateurRendu;
  b.on("disconnected", () => {
    etat.navigateurRendu = undefined;
  });
  return b;
}

const limite = Math.max(1, Number(process.env.RENDUS_SIMULTANES) || 2);
export const LARGEUR_REDUITE = 1620;
export const LARGEUR_HD = Math.max(LARGEUR_REDUITE, Number(process.env.LARGEUR_HD) || 3600);
const DELAI_HD_MS = 180_000;
let enCours = 0;
const attente: { poids: number; ok: () => void }[] = [];

function servirAttente() {
  // Dans l'ordre d'arrivée : un rendu lourd en tête bloque les suivants jusqu'à ce qu'il puisse passer.
  while (attente.length && enCours + attente[0]!.poids <= limite) {
    const a = attente.shift()!;
    enCours += a.poids;
    a.ok();
  }
}

/** File d'attente pondérée : un rendu ordinaire prend une place, un rendu lourd les prend toutes. */
async function avecPlace<T>(f: () => Promise<T>, lourd = false): Promise<T> {
  const poids = lourd ? limite : 1;
  await new Promise<void>((ok) => {
    attente.push({ poids, ok });
    servirAttente();
  });
  try {
    return await f();
  } finally {
    enCours -= poids;
    servirAttente();
  }
}

/** Réduit une image à `largeurMax` px de large, dans Chromium (même format ; transparence des PNG conservée). */
export async function reduireImage(contenu: Buffer, type: string, largeurMax = LARGEUR_REDUITE): Promise<Buffer> {
  return avecPlace(async () => {
    const page = await (await navigateur()).newPage();
    try {
      // Origine fictive : une page HTML vide, et l'image à réduire.
      await page.route("https://image.aeemci.local/**", (r) =>
        new URL(r.request().url()).pathname === "/source"
          ? r.fulfill({ status: 200, contentType: type, body: contenu })
          : r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>réduction</title>" }),
      );
      await page.goto("https://image.aeemci.local/page", { waitUntil: "commit" }).catch(() => undefined);
      await page.setContent('<img id="i" src="https://image.aeemci.local/source">', { waitUntil: "load" });
      const sortie = type === "image/jpeg" ? "image/jpeg" : "image/png";
      const dataUrl = await page.evaluate(async ([max, sortie]) => {
        const img = document.getElementById("i") as HTMLImageElement;
        await img.decode();
        const echelle = Math.min(1, max / img.naturalWidth);
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * echelle);
        c.height = Math.round(img.naturalHeight * echelle);
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL(sortie, 0.92);
      }, [largeurMax, sortie] as const);
      return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    } finally {
      await page.close();
    }
  }, true);
}

// ── Fichiers des révisions ─────────────────────────────────────────────────────

export interface RevisionARendre {
  id: string;
  prefixe: string;
  contenu: Gabarit;
}

/** Fichiers référencés par un gabarit (fonds et couches), chemins relatifs au dossier publié. */
export function fichiersDuGabarit(g: Gabarit): string[] {
  return [...new Set(g.plans.flatMap((p) => [...(p.fond ? [p.fond] : []), ...(p.couches ?? []).map((c) => c.fichier)]))];
}

const preparations = new Map<string, Promise<string>>();

/**
 * Dossier local contenant les fichiers de la révision (téléchargés au premier rendu).
 * `reduit` : les copies réduites si l'import les a préparées, sinon les originaux.
 */
export function dossierDeRevision(r: RevisionARendre, version: "reduit" | "original" = "original"): Promise<string> {
  const cleCache = `${r.id}/${version}`;
  const dossier = path.join(DOSSIER_CACHE, "revisions", r.id, version);
  let p = preparations.get(cleCache);
  if (!p) {
    p = (async () => {
      if (existsSync(path.join(dossier, ".pret"))) return dossier;
      for (const f of fichiersDuGabarit(r.contenu)) {
        const contenu = (version === "reduit" ? await stockage().lire(`${r.prefixe}/reduit/${f}`) : null) ?? (await stockage().lire(`${r.prefixe}/${f}`));
        if (!contenu) throw new Error(`Fichier du gabarit absent du stockage : ${f}`);
        const cible = path.join(dossier, f);
        await fs.mkdir(path.dirname(cible), { recursive: true });
        await fs.writeFile(cible, contenu);
      }
      await fs.writeFile(path.join(dossier, ".pret"), "");
      return dossier;
    })();
    preparations.set(cleCache, p);
    p.catch(() => preparations.delete(cleCache));
  }
  return p;
}

/** Dossier local des photos téléversées (copiées du stockage à la demande). */
export async function cheminDeTeleversement(cle: string): Promise<string> {
  const cible = path.join(DOSSIER_CACHE, cle);
  if (!existsSync(cible)) {
    const contenu = await stockage().lire(cle);
    if (!contenu) throw new Error("Photo introuvable dans le stockage.");
    await fs.mkdir(path.dirname(cible), { recursive: true });
    await fs.writeFile(cible, contenu);
  }
  return cible;
}

// ── Rendu ──────────────────────────────────────────────────────────────────────

export interface DemandeRendu {
  revision: RevisionARendre;
  /** Valeurs prêtes pour le moteur : les images sont des chemins locaux absolus. */
  valeurs: Valeurs;
  plan?: string;
  format?: "png" | "jpeg";
  /** Largeur de sortie maximale ; jamais plus que le plan lui-même. */
  largeurMax?: number;
  /** Haute définition : fonds originaux, largeur `LARGEUR_HD`, rendu seul. */
  hd?: boolean;
}

export async function rendre(d: DemandeRendu): Promise<ResultatRendu> {
  const plan = d.plan ? d.revision.contenu.plans.find((p) => p.plan === d.plan) : d.revision.contenu.plans[0];
  const largeurMax = d.hd ? LARGEUR_HD : d.largeurMax;
  const largeur = plan && largeurMax ? Math.min(largeurMax, plan.largeur_px) : undefined;
  // Les copies réduites suffisent tant que la sortie ne dépasse pas leur largeur.
  const reduit = !d.hd && largeur !== undefined && largeur <= LARGEUR_REDUITE;
  const dossier = await dossierDeRevision(d.revision, reduit ? "reduit" : "original");
  return avecPlace(async () =>
    rendrePlan({
      gabarit: d.revision.contenu,
      dossier,
      valeurs: d.valeurs,
      polices: catalogue(),
      plan: plan?.plan,
      format: d.format ?? "png",
      largeurSortie: largeur,
      navigateur: await navigateur(),
      // Mesuré : plus de 30 s pour la HD du panéliste sur une t3.small (2 vCPU, sans GPU).
      delaiMs: d.hd ? DELAI_HD_MS : undefined,
    }),
    d.hd,
  );
}

/** Document en mode page (HTML A4) : le PDF et la miniature JPEG de sa première page, l'un après l'autre. */
export async function rendrePageA4(o: Omit<OptionsDocument, "navigateur">, largeurMiniature: number): Promise<{ pdf: Buffer; miniature: Buffer }> {
  return avecPlace(async () => {
    const b = await navigateur();
    const pdf = await rendreDocumentPdf({ ...o, navigateur: b });
    const miniature = await rendreApercuDocument({ ...o, navigateur: b, largeur: largeurMiniature, format: "jpeg" });
    return { pdf, miniature };
  });
}

/** PDF A4 seul (dossier de passation…), sans miniature. */
export async function rendrePdfA4(o: Omit<OptionsDocument, "navigateur">): Promise<Buffer> {
  return avecPlace(async () => rendreDocumentPdf({ ...o, navigateur: await navigateur() }));
}
