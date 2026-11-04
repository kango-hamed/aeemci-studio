import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { reconnaitre } from "@/fonctionnalites/documents/deposer";
import { peutCreerDocuments, peutGererCachet, type Acteur } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

/**
 * Signature de chaque membre et cachet de la section : des images privées, apposées sur les documents
 * administratifs à leur validation. Le navigateur les détoure (fond blanc rendu transparent) avant l'envoi.
 * Remplacer une image ne change pas les documents déjà validés : leur PDF est figé.
 */

export const TAILLE_MAX_IMAGE = 2 * 1024 * 1024;

function verifierImage(contenu: Buffer): { type: string; ext: string } {
  if (!contenu.length) throw new ErreurSaisie("L'image est vide.");
  if (contenu.length > TAILLE_MAX_IMAGE) throw new ErreurSaisie("Image trop lourde (2 Mo au plus).");
  const genre = reconnaitre(contenu);
  if (!genre || !genre.type.startsWith("image/")) throw new ErreurSaisie("Envoie une image (PNG, JPEG ou WebP).");
  return genre;
}

/** Signer avec une image qui porte déjà le cachet : réservé à qui valide (président, vice-président pour l'intérim). */
export const peutSignerAvecCachet = (u: Acteur) => u.affectation?.role === "president" || u.affectation?.role === "vice_president";

/**
 * Enregistre la signature du membre. `avecCachet` : l'image porte déjà le cachet de la section
 * (signature et cachet scannés ensemble) ; à la validation, aucun cachet n'est ajouté.
 */
export async function enregistrerSignature(u: Acteur, contenu: Buffer, avecCachet = false): Promise<void> {
  if (!peutCreerDocuments(u)) throw new ErreurSaisie("Tu n'as pas de rôle dans le mandat en cours.");
  if (avecCachet && !peutSignerAvecCachet(u)) throw new ErreurSaisie("Seuls le président et les vice-présidents signent avec le cachet.");
  const genre = verifierImage(contenu);
  const cle = `signatures/${u.id}/${randomUUID()}.${genre.ext}`;
  await stockage().ecrire(cle, contenu, genre.type);
  const [ancienne] = await db.select({ cle: schema.signature.cle }).from(schema.signature).where(eq(schema.signature.userId, u.id));
  await db
    .insert(schema.signature)
    .values({ userId: u.id, cle, avecCachet })
    .onConflictDoUpdate({ target: schema.signature.userId, set: { cle, avecCachet } });
  if (ancienne) await stockage().supprimer(ancienne.cle);
}

export async function enregistrerCachet(u: Acteur, contenu: Buffer): Promise<void> {
  if (!peutGererCachet(u)) throw new ErreurSaisie("Seul le président enregistre le cachet de la section.");
  const m = await mandatCourant();
  if (!m) throw new ErreurSaisie("Aucun mandat en cours.");
  const genre = verifierImage(contenu);
  const cle = `sections/${m.sectionId}/cachet-${randomUUID()}.${genre.ext}`;
  await stockage().ecrire(cle, contenu, genre.type);
  const [ancien] = await db.select({ cle: schema.section.cachet }).from(schema.section).where(eq(schema.section.id, m.sectionId));
  await db.update(schema.section).set({ cachet: cle }).where(eq(schema.section.id, m.sectionId));
  if (ancien?.cle) await stockage().supprimer(ancien.cle);
}

/** Vice-présidents du mandat en cours, parmi lesquels le président choisit l'intérimaire. */
export async function vicePresidents(mandatId: string): Promise<{ id: string; nom: string }[]> {
  const a = schema.affectation;
  return db
    .select({ id: schema.user.id, nom: schema.user.name })
    .from(a)
    .innerJoin(schema.user, eq(schema.user.id, a.userId))
    .where(and(eq(a.mandatId, mandatId), eq(a.role, "vice_president")))
    .orderBy(schema.user.name);
}

/** Le président confie l'intérim à un vice-président (`null` : il le lève) ; lui seul valide et signe à sa place. */
export async function changerInterim(u: Acteur, interimaire: string | null): Promise<void> {
  if (!peutGererCachet(u)) throw new ErreurSaisie("Seul le président active l'intérim.");
  const m = await mandatCourant();
  if (!m) throw new ErreurSaisie("Aucun mandat en cours.");
  if (interimaire && !(await vicePresidents(m.id)).some((v) => v.id === interimaire))
    throw new ErreurSaisie("L'intérim se confie à un vice-président du mandat en cours.");
  await db.update(schema.mandat).set({ interimaireId: interimaire }).where(eq(schema.mandat.id, m.id));
}
