import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, max } from "drizzle-orm";
import { controlerGabarit, valeursEssai, type Gabarit } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";
import { catalogue, fichiersDuGabarit, LARGEUR_REDUITE, reduireImage, rendre } from "@/fonctionnalites/generation/rendu";

export const FICHIER_PUBLIE = "gabarit.publie.json";
export const TAILLE_MAX_IMPORT = 30 * 1024 * 1024;

export class ErreurImport extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

export interface ResultatImport {
  gabaritId: string;
  revisionId: string;
  numero: number;
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
  const publie = [...propres.keys()].find((c) => c === FICHIER_PUBLIE || c.endsWith(`/${FICHIER_PUBLIE}`));
  if (!publie || publie === FICHIER_PUBLIE) return propres;
  const racine = publie.slice(0, -FICHIER_PUBLIE.length);
  const sortie = new Map<string, Buffer>();
  for (const [c, b] of propres) if (c.startsWith(racine)) sortie.set(c.slice(racine.length), b);
  return sortie;
}

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/**
 * Importe le dossier d'un gabarit publié par l'atelier (`gabarit.publie.json` + fichiers du plugin).
 * Un gabarit du même nom reçoit une nouvelle révision ; les documents déjà créés gardent la leur.
 */
export async function importerGabarit(envoyes: Map<string, Buffer>, userId: string): Promise<ResultatImport> {
  const fichiers = normaliserChemins(envoyes);
  const brut = fichiers.get(FICHIER_PUBLIE);
  if (!brut) throw new ErreurImport(`Le dossier ne contient pas « ${FICHIER_PUBLIE} ». Ouvre-le d'abord dans l'atelier et clique sur « Publier ».`);
  let pub: Publication;
  try {
    pub = JSON.parse(brut.toString("utf8")) as Publication;
  } catch {
    throw new ErreurImport(`« ${FICHIER_PUBLIE} » est illisible (JSON invalide).`);
  }
  if (pub.format !== "aeemci-studio/gabarit-publie" || !pub.gabarit || !Array.isArray(pub.gabarit.plans) || !Array.isArray(pub.gabarit.champs))
    throw new ErreurImport(`« ${FICHIER_PUBLIE} » n'est pas une publication de l'atelier AEEMCI Studio.`);
  const gabarit = pub.gabarit;
  const nom = String(pub.nom ?? "").trim();
  if (!nom) throw new ErreurImport("La publication n'a pas de nom.");

  const utiles = fichiersDuGabarit(gabarit);
  for (const f of utiles) {
    if (path.isAbsolute(f) || f.split(/[\\/]/).includes("..")) throw new ErreurImport(`Chemin de fichier refusé : ${f}`);
    if (!TYPES[path.extname(f).toLowerCase()]) throw new ErreurImport(`Type de fichier non pris en charge : ${f}`);
  }

  // Contrôles du moteur sur une copie locale (fichiers présents, polices installées, champs cohérents).
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aeemci-import-"));
  try {
    for (const f of utiles) {
      const b = fichiers.get(f);
      if (!b) continue;
      await fs.mkdir(path.dirname(path.join(tmp, f)), { recursive: true });
      await fs.writeFile(path.join(tmp, f), b);
    }
    const controles = controlerGabarit(gabarit, catalogue(), tmp);
    if (controles.bloquants.length) throw new ErreurImport("Le gabarit ne peut pas être importé :", controles.bloquants);

    const slug = slugDe(nom);
    const [existant] = await db.select().from(schema.gabarit).where(eq(schema.gabarit.slug, slug));
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

    const numero = await db.transaction(async (tx) => {
      if (existant) await tx.update(schema.gabarit).set({ nom, description: pub.description ?? null, actif: true }).where(eq(schema.gabarit.id, gabaritId));
      else await tx.insert(schema.gabarit).values({ id: gabaritId, slug, nom, description: pub.description ?? null });
      const [{ dernier }] = await tx.select({ dernier: max(schema.revisionGabarit.numero) }).from(schema.revisionGabarit).where(eq(schema.revisionGabarit.gabaritId, gabaritId));
      const n = (dernier ?? 0) + 1;
      await tx.insert(schema.revisionGabarit).values({ id: revisionId, gabaritId, numero: n, contenu: gabarit, prefixe, revisionAtelier: pub.revision ?? null, importeParId: userId });
      await tx.update(schema.gabarit).set({ revisionCouranteId: revisionId }).where(eq(schema.gabarit.id, gabaritId));
      return n;
    });

    // Vignette avec les valeurs d'exemple du designer ; un échec ici ne bloque pas l'import.
    const remarques = [...controles.remarques];
    try {
      const r = await rendre({ revision: { id: revisionId, prefixe, contenu: gabarit }, valeurs: valeursEssai(gabarit, "exemple"), format: "jpeg", largeurMax: 480 });
      await stockage().ecrire(`${prefixe}/vignette.jpg`, r.fichier, "image/jpeg");
      await db.update(schema.revisionGabarit).set({ vignette: `${prefixe}/vignette.jpg` }).where(eq(schema.revisionGabarit.id, revisionId));
    } catch (e) {
      remarques.push(`Vignette non générée : ${e instanceof Error ? e.message : String(e)}`);
    }
    return { gabaritId, revisionId, numero, nom, nouveau: !existant, remarques };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
