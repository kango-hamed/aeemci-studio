import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { controlerGabarit, type Gabarit } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";
import { catalogue, fichiersDuGabarit, LARGEUR_REDUITE, reduireImage } from "@/fonctionnalites/generation/rendu";
import { fusionnerReglages } from "./reglages";
import { ErreurGabarit, publierBrouillon } from "./atelier";

/** Écrit autrefois par l'atelier local ; un tel dossier s'importe encore, avec ses réglages. */
export const FICHIER_PUBLIE = "gabarit.publie.json";
export const FICHIER_MANIFEST = "manifest.json";
export const TAILLE_MAX_IMPORT = 30 * 1024 * 1024;

/** Refus d'import, avec les points à corriger : la même erreur que celles de l'écran du gabarit. */
export { ErreurGabarit as ErreurImport };

export interface ResultatImport {
  gabaritId: string;
  revisionId: string;
  /** Numéro de révision si le gabarit a été publié dans la foulée. */
  numero: number | null;
  nom: string;
  nouveau: boolean;
  remarques: string[];
}

interface Publication {
  format?: string;
  revision?: number;
  nom?: string;
  description?: string;
  gabarit?: Gabarit;
}

/** « Présentation d'un panéliste » → « presentation-d-un-paneliste ». */
export function slugDe(nom: string): string {
  return (
    nom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "gabarit"
  );
}

/** Chemins du dossier envoyé, sans le nom du dossier lui-même (« panel/gabarit/fond.png » → « gabarit/fond.png »). */
export function normaliserChemins(fichiers: Map<string, Buffer>): Map<string, Buffer> {
  const propres = new Map<string, Buffer>();
  for (const [c, b] of fichiers) propres.set(c.replace(/\\/g, "/").replace(/^\/+/, ""), b);
  const repere = [FICHIER_PUBLIE, FICHIER_MANIFEST]
    .map((nom) => [...propres.keys()].filter((c) => c === nom || c.endsWith(`/${nom}`)).sort((a, b) => a.length - b.length)[0])
    .find(Boolean);
  if (!repere || !repere.includes("/")) return propres;
  const racine = repere.slice(0, repere.lastIndexOf("/") + 1);
  const sortie = new Map<string, Buffer>();
  for (const [c, b] of propres) if (c.startsWith(racine)) sortie.set(c.slice(racine.length), b);
  return sortie;
}

function lireJson<T>(b: Buffer, nom: string): T {
  try {
    return JSON.parse(b.toString("utf8")) as T;
  } catch {
    throw new ErreurGabarit(`« ${nom} » est illisible (JSON invalide).`);
  }
}

/** Le gabarit du dossier : celui du plugin (manifest), ou une ancienne publication de l'atelier qui porte déjà ses réglages. */
export function lireDossier(fichiers: Map<string, Buffer>): { gabarit: Gabarit; nom: string; description?: string; reglagesInclus: boolean; revisionAtelier?: number } {
  const publie = fichiers.get(FICHIER_PUBLIE);
  if (publie) {
    const pub = lireJson<Publication>(publie, FICHIER_PUBLIE);
    if (pub.format !== "aeemci-studio/gabarit-publie" || !pub.gabarit || !Array.isArray(pub.gabarit.plans) || !Array.isArray(pub.gabarit.champs))
      throw new ErreurGabarit(`« ${FICHIER_PUBLIE} » n'est pas une publication de l'atelier AEEMCI Studio.`);
    const nom = String(pub.nom ?? "").trim();
    if (!nom) throw new ErreurGabarit("La publication n'a pas de nom.");
    return { gabarit: pub.gabarit, nom, description: pub.description, reglagesInclus: true, revisionAtelier: pub.revision };
  }
  const brut = fichiers.get(FICHIER_MANIFEST);
  if (!brut) throw new ErreurGabarit(`Le dossier ne contient pas « ${FICHIER_MANIFEST} » : choisis le dossier produit par le plugin Photoshop.`);
  const manifest = lireJson<{ gabarit?: Gabarit; document?: { nom_fichier?: string } }>(brut, FICHIER_MANIFEST);
  const g = manifest.gabarit;
  if (!g || !Array.isArray(g.plans) || !Array.isArray(g.champs))
    throw new ErreurGabarit("Ce manifest n'a pas de section « gabarit » : marque des calques dans le plugin, puis génère de nouveau.");
  const nom = String(manifest.document?.nom_fichier ?? "").replace(/\.[^.]+$/, "").trim() || "Gabarit";
  return { gabarit: g, nom, reglagesInclus: false };
}

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export interface OptionsImport {
  /** Gabarit existant dont le dossier devient la nouvelle version ; sinon, celui du même nom ou un nouveau. */
  gabaritId?: string;
  /** Publier tout de suite (s'il n'y a aucun point bloquant) au lieu de laisser un brouillon à régler. */
  publier?: boolean;
}

/**
 * Importe le dossier d'un gabarit produit par le plugin Photoshop. Le résultat est un brouillon, à régler
 * puis publier dans l'écran du gabarit ; les réglages de la version précédente (libellés, aides,
 * débordements) sont repris pour les champs et zones qui existent encore.
 */
export async function importerGabarit(envoyes: Map<string, Buffer>, userId: string, o: OptionsImport = {}): Promise<ResultatImport> {
  const fichiers = normaliserChemins(envoyes);
  const lu = lireDossier(fichiers);

  const utiles = fichiersDuGabarit(lu.gabarit);
  for (const f of utiles) {
    if (path.isAbsolute(f) || f.split(/[\\/]/).includes("..")) throw new ErreurGabarit(`Chemin de fichier refusé : ${f}`);
    if (!TYPES[path.extname(f).toLowerCase()]) throw new ErreurGabarit(`Type de fichier non pris en charge : ${f}`);
  }

  const [existant] = o.gabaritId
    ? await db.select().from(schema.gabarit).where(eq(schema.gabarit.id, o.gabaritId))
    : await db.select().from(schema.gabarit).where(eq(schema.gabarit.slug, slugDe(lu.nom)));
  if (o.gabaritId && !existant) throw new ErreurGabarit("Gabarit introuvable.");

  // Réglages repris de la version la plus récente : le brouillon en cours, sinon la révision publiée.
  let gabarit = lu.gabarit;
  if (existant && !lu.reglagesInclus) {
    const [base] = await db
      .select({ contenu: schema.revisionGabarit.contenu })
      .from(schema.revisionGabarit)
      .where(eq(schema.revisionGabarit.gabaritId, existant.id))
      .orderBy(schema.revisionGabarit.createdAt)
      .then((l) => l.slice(-1));
    if (base) gabarit = fusionnerReglages(lu.gabarit, base.contenu);
  }

  // Seuls les fichiers et les polices empêchent l'import : le reste se corrige dans l'écran du gabarit.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aeemci-import-"));
  try {
    for (const f of utiles) {
      const b = fichiers.get(f);
      if (!b) continue;
      await fs.mkdir(path.dirname(path.join(tmp, f)), { recursive: true });
      await fs.writeFile(path.join(tmp, f), b);
    }
    const controles = controlerGabarit(gabarit, catalogue(), tmp);
    const bloquants = controles.bloquants.filter((b) => /introuvable|non installée/.test(b));
    if (bloquants.length) throw new ErreurGabarit("Le gabarit ne peut pas être importé :", bloquants);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }

  const gabaritId = existant?.id ?? randomUUID();
  const revisionId = randomUUID();
  const prefixe = `gabarits/${gabaritId}/${revisionId}`;
  for (const f of utiles) await stockage().ecrire(`${prefixe}/${f}`, fichiers.get(f)!, TYPES[path.extname(f).toLowerCase()]!);
  // Copies réduites des fichiers des plans plus larges que nécessaire pour l'aperçu et les réseaux.
  const aReduire = new Set(gabarit.plans.filter((p) => p.largeur_px > LARGEUR_REDUITE).flatMap((p) => [...(p.fond ? [p.fond] : []), ...(p.couches ?? []).map((c) => c.fichier)]));
  for (const f of aReduire) {
    const type = TYPES[path.extname(f).toLowerCase()]!;
    await stockage().ecrire(`${prefixe}/reduit/${f}`, await reduireImage(fichiers.get(f)!, type), type);
  }

  await db.transaction(async (tx) => {
    if (existant) {
      // Un seul brouillon par gabarit : le nouveau dossier remplace celui qui était en cours.
      await tx.delete(schema.revisionGabarit).where(and(eq(schema.revisionGabarit.gabaritId, gabaritId), isNull(schema.revisionGabarit.publieeLe)));
      if (lu.reglagesInclus) await tx.update(schema.gabarit).set({ nom: lu.nom, description: lu.description ?? null }).where(eq(schema.gabarit.id, gabaritId));
    } else await tx.insert(schema.gabarit).values({ id: gabaritId, slug: slugDe(lu.nom), nom: lu.nom, description: lu.description ?? null });
    await tx.insert(schema.revisionGabarit).values({ id: revisionId, gabaritId, contenu: gabarit, prefixe, revisionAtelier: lu.revisionAtelier ?? null, importeParId: userId });
  });

  const nom = existant && !lu.reglagesInclus ? existant.nom : lu.nom;
  if (!o.publier) return { gabaritId, revisionId, numero: null, nom, nouveau: !existant, remarques: [] };
  const p = await publierBrouillon(revisionId, userId);
  return { gabaritId, revisionId, numero: p.numero, nom, nouveau: !existant, remarques: p.remarques };
}
