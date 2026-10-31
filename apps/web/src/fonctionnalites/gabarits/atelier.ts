import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import { controlerGabarit, PHOTO_ESSAI, valeursEssai, type Controles, type Gabarit, type Valeurs } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";
import { catalogue, dossierDeRevision, rendre } from "@/fonctionnalites/generation/rendu";
import { peutGererGabarits, type Acteur } from "@/fonctionnalites/organisation/droits";
import { appliquerReglages, ReglagesInvalides } from "./reglages";

/**
 * Écran d'un gabarit (administrateurs et designers) : régler le brouillon, le voir rendu par le vrai
 * moteur, le publier ; changer la fiche (nom, réservation, activation) ; revenir à une révision.
 * Une révision publiée ne change plus : les documents la gardent pour être refaits à l'identique.
 */
export class ErreurGabarit extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

function exigerGestion(u: Acteur) {
  if (!peutGererGabarits(u)) throw new ErreurGabarit("Réservé aux administrateurs et aux designers.");
}

async function gabaritExistant(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ErreurGabarit("Gabarit introuvable.");
  const [g] = await db.select().from(schema.gabarit).where(eq(schema.gabarit.id, id));
  if (!g) throw new ErreurGabarit("Gabarit introuvable.");
  return g;
}

async function brouillonDe(gabaritId: string) {
  const [b] = await db
    .select()
    .from(schema.revisionGabarit)
    .where(and(eq(schema.revisionGabarit.gabaritId, gabaritId), isNull(schema.revisionGabarit.publieeLe)));
  return b ?? null;
}

/** Contrôles du moteur sur les fichiers de la révision (copiés en local au premier appel). */
export async function controlesDe(r: { id: string; prefixe: string; contenu: Gabarit }): Promise<Controles> {
  return controlerGabarit(r.contenu, catalogue(), await dossierDeRevision(r));
}

/**
 * Brouillon du gabarit : celui en cours, sinon une copie de la révision publiée (mêmes fichiers),
 * pour en changer les réglages sans repasser par Photoshop.
 */
export async function ouvrirBrouillon(u: Acteur, gabaritId: string) {
  exigerGestion(u);
  const g = await gabaritExistant(gabaritId);
  const deja = await brouillonDe(g.id);
  if (deja) return deja;
  if (!g.revisionCouranteId) throw new ErreurGabarit("Ce gabarit n'a ni brouillon ni révision publiée : importe son dossier.");
  const [courante] = await db.select().from(schema.revisionGabarit).where(eq(schema.revisionGabarit.id, g.revisionCouranteId));
  const [b] = await db
    .insert(schema.revisionGabarit)
    .values({ id: randomUUID(), gabaritId: g.id, contenu: courante!.contenu, prefixe: courante!.prefixe, revisionAtelier: courante!.revisionAtelier, importeParId: u.id })
    .returning();
  return b!;
}

/** Enregistre les réglages du brouillon et renvoie les contrôles à jour. */
export async function enregistrerBrouillon(u: Acteur, gabaritId: string, recu: Gabarit): Promise<Controles> {
  exigerGestion(u);
  const b = await brouillonDe((await gabaritExistant(gabaritId)).id);
  if (!b) throw new ErreurGabarit("Ce brouillon a été publié ou abandonné entre-temps : recharge la page.");
  let contenu: Gabarit;
  try {
    contenu = appliquerReglages(b.contenu, recu);
  } catch (e) {
    if (e instanceof ReglagesInvalides) throw new ErreurGabarit(e.message);
    throw e;
  }
  await db.update(schema.revisionGabarit).set({ contenu }).where(eq(schema.revisionGabarit.id, b.id));
  return controlesDe({ ...b, contenu });
}

/** Abandonne le brouillon ; la révision publiée (s'il y en a une) reste en service. */
export async function abandonnerBrouillon(u: Acteur, gabaritId: string): Promise<void> {
  exigerGestion(u);
  const g = await gabaritExistant(gabaritId);
  await db.delete(schema.revisionGabarit).where(and(eq(schema.revisionGabarit.gabaritId, g.id), isNull(schema.revisionGabarit.publieeLe)));
  // Un gabarit importé puis abandonné avant toute publication n'a plus de raison d'exister.
  if (!g.revisionCouranteId) await db.delete(schema.gabarit).where(eq(schema.gabarit.id, g.id));
}

/**
 * Publie un brouillon : contrôles complets, numéro de révision suivant, vignette avec les valeurs
 * d'exemple. Les membres utilisent la nouvelle révision dès maintenant. Droits vérifiés par l'appelant.
 */
export async function publierBrouillon(revisionId: string, userId: string): Promise<{ numero: number; remarques: string[] }> {
  const [b] = await db
    .select()
    .from(schema.revisionGabarit)
    .where(and(eq(schema.revisionGabarit.id, revisionId), isNull(schema.revisionGabarit.publieeLe)));
  if (!b) throw new ErreurGabarit("Ce brouillon a déjà été publié ou abandonné : recharge la page.");
  const controles = await controlesDe(b);
  if (controles.bloquants.length) throw new ErreurGabarit("Publication impossible : corrige d'abord ces points.", controles.bloquants);

  const numero = await db.transaction(async (tx) => {
    const [{ dernier }] = await tx
      .select({ dernier: max(schema.revisionGabarit.numero) })
      .from(schema.revisionGabarit)
      .where(eq(schema.revisionGabarit.gabaritId, b.gabaritId));
    const n = (dernier ?? 0) + 1;
    await tx.update(schema.revisionGabarit).set({ numero: n, publieeLe: new Date(), publieeParId: userId }).where(eq(schema.revisionGabarit.id, b.id));
    await tx.update(schema.gabarit).set({ revisionCouranteId: b.id, actif: true }).where(eq(schema.gabarit.id, b.gabaritId));
    return n;
  });

  // Vignette de la liste des gabarits ; un échec ici ne bloque pas la publication.
  const remarques = [...controles.remarques];
  try {
    const r = await rendre({ revision: b, valeurs: valeursEssai(b.contenu, "exemple"), format: "jpeg", largeurMax: 480 });
    const cle = `${b.prefixe}/vignette-${b.id}.jpg`;
    await stockage().ecrire(cle, r.fichier, "image/jpeg");
    await db.update(schema.revisionGabarit).set({ vignette: cle }).where(eq(schema.revisionGabarit.id, b.id));
  } catch (e) {
    remarques.push(`Vignette non générée : ${e instanceof Error ? e.message : String(e)}`);
  }
  return { numero, remarques };
}

export async function publier(u: Acteur, gabaritId: string): Promise<{ numero: number; remarques: string[] }> {
  exigerGestion(u);
  const b = await brouillonDe((await gabaritExistant(gabaritId)).id);
  if (!b) throw new ErreurGabarit("Rien à publier : pas de brouillon en cours.");
  return publierBrouillon(b.id, u.id);
}

export interface Fiche {
  nom: string;
  description: string;
  /** Délégations réservées ; vide : toute la section. */
  delegations: string[];
  actif: boolean;
}

/** Nom, description, réservation et activation. Le nom affiché change ; l'identifiant d'import (slug) reste. */
export async function modifierFiche(u: Acteur, gabaritId: string, f: Fiche): Promise<void> {
  exigerGestion(u);
  const g = await gabaritExistant(gabaritId);
  const nom = f.nom.trim().replace(/\s+/g, " ");
  if (nom.length < 2 || nom.length > 80) throw new ErreurGabarit("Le nom d'un gabarit fait de 2 à 80 caractères.");
  const description = f.description.trim().slice(0, 300) || null;
  const ids = [...new Set(f.delegations)];
  if (ids.length) {
    const connues = await db.select({ id: schema.delegation.id }).from(schema.delegation).where(inArray(schema.delegation.id, ids));
    if (connues.length !== ids.length) throw new ErreurGabarit("Délégation inconnue.");
  }
  if (f.actif && !g.revisionCouranteId) throw new ErreurGabarit("Publie d'abord le gabarit pour l'activer.");
  await db.transaction(async (tx) => {
    await tx.update(schema.gabarit).set({ nom, description, actif: f.actif }).where(eq(schema.gabarit.id, g.id));
    await tx.delete(schema.gabaritDelegation).where(eq(schema.gabaritDelegation.gabaritId, g.id));
    if (ids.length) await tx.insert(schema.gabaritDelegation).values(ids.map((delegationId) => ({ gabaritId: g.id, delegationId })));
  });
}

/** Remet en service une révision publiée plus ancienne (après une publication ratée, par exemple). */
export async function retablirRevision(u: Acteur, gabaritId: string, revisionId: string): Promise<number> {
  exigerGestion(u);
  const g = await gabaritExistant(gabaritId);
  const [r] = await db
    .select()
    .from(schema.revisionGabarit)
    .where(and(eq(schema.revisionGabarit.id, revisionId), eq(schema.revisionGabarit.gabaritId, g.id), isNotNull(schema.revisionGabarit.publieeLe)));
  if (!r) throw new ErreurGabarit("Révision introuvable.");
  await db.update(schema.gabarit).set({ revisionCouranteId: r.id }).where(eq(schema.gabarit.id, g.id));
  return r.numero!;
}

export type ModeEssai = "exemple" | "long" | "perso";

/** Aperçu du brouillon avec les réglages en cours (pas encore enregistrés), par le vrai moteur. */
export async function apercuBrouillon(
  u: Acteur,
  gabaritId: string,
  d: { contenu: Gabarit; mode: ModeEssai; valeurs?: Record<string, string | number | null>; plan?: string },
) {
  exigerGestion(u);
  const b = await brouillonDe((await gabaritExistant(gabaritId)).id);
  if (!b) throw new ErreurGabarit("Pas de brouillon en cours : recharge la page.");
  let contenu: Gabarit;
  try {
    contenu = appliquerReglages(b.contenu, d.contenu);
  } catch (e) {
    if (e instanceof ReglagesInvalides) throw new ErreurGabarit(e.message);
    throw e;
  }
  let valeurs: Valeurs;
  if (d.mode === "perso") {
    // Les valeurs saisies, l'exemple pour ce qui reste vide ; une photo d'essai pour les images.
    const exemple = valeursEssai(contenu, "exemple");
    valeurs = {};
    for (const c of contenu.champs) {
      const v = d.valeurs?.[c.nom];
      valeurs[c.nom] = c.type === "image" ? PHOTO_ESSAI : v === undefined || v === null || v === "" ? exemple[c.nom]! : c.type === "nombre" || c.type === "jauge" ? Number(v) : String(v);
    }
  } else valeurs = valeursEssai(contenu, d.mode);
  return rendre({ revision: { id: b.id, prefixe: b.prefixe, contenu }, valeurs, plan: d.plan, format: "png", largeurMax: 720 });
}
