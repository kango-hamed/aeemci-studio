import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import type { Acteur } from "@/fonctionnalites/organisation/droits";
import { activiteModifiable } from "./gestion";
import { SchemaEditions, SchemaResultats, texteBilan, type EditionTheDebat } from "./the-debat-bilan";

/**
 * Liaison avec la plateforme Thé Débat (site séparé, sa propre base) : une activité est liée à une édition,
 * et Studio en récupère le bilan par `/api/bilan`, avec la clé partagée `THE_DEBAT_CLE`. Lecture seule,
 * dans un seul sens ; aucun numéro de téléphone ne circule.
 */

const DELAI = 10_000;

function configuration(): { url: string; cle: string } | null {
  const url = process.env.THE_DEBAT_URL?.trim().replace(/\/+$/, "");
  const cle = process.env.THE_DEBAT_CLE?.trim();
  return url && cle ? { url, cle } : null;
}

export const theDebatConfigure = () => configuration() !== null;

async function appeler(chemin: string): Promise<unknown> {
  const c = configuration();
  if (!c) throw new ErreurSaisie("La liaison avec Thé Débat n'est pas configurée (THE_DEBAT_URL et THE_DEBAT_CLE).");
  let r: Response;
  try {
    r = await fetch(`${c.url}/api/bilan${chemin}`, { headers: { authorization: `Bearer ${c.cle}` }, cache: "no-store", signal: AbortSignal.timeout(DELAI) });
  } catch {
    throw new ErreurSaisie("La plateforme Thé Débat ne répond pas. Réessaie dans un instant.");
  }
  if (r.status === 401) throw new ErreurSaisie("Thé Débat refuse l'accès : la clé partagée ne correspond pas.");
  if (r.status === 404) throw new ErreurSaisie("Cette édition n'existe plus sur Thé Débat.");
  if (!r.ok) throw new ErreurSaisie(`Thé Débat a répondu par une erreur (${r.status}).`);
  return r.json();
}

/** Éditions de Thé Débat, pour en lier une à l'activité. */
export async function editionsTheDebat(): Promise<EditionTheDebat[]> {
  const lu = SchemaEditions.safeParse(await appeler(""));
  if (!lu.success) throw new ErreurSaisie("Réponse de Thé Débat inattendue.");
  return lu.data.editions;
}

/** Lie l'activité à une édition et en récupère aussitôt le bilan ; `null` : défait la liaison. */
export async function lierEdition(u: Acteur, activiteId: string, editionId: string | null): Promise<void> {
  await activiteModifiable(u, activiteId);
  if (!editionId) {
    await db.update(schema.activite).set({ debatEditionId: null, debatResultats: null, debatRecupereLe: null }).where(eq(schema.activite.id, activiteId));
    return;
  }
  if (!/^[0-9a-f-]{36}$/i.test(editionId)) throw new ErreurSaisie("Édition inconnue.");
  await enregistrer(activiteId, editionId);
}

/** Met à jour le bilan récupéré de l'édition liée. */
export async function recupererResultats(u: Acteur, activiteId: string): Promise<void> {
  const l = await activiteModifiable(u, activiteId);
  if (!l.a.debatEditionId) throw new ErreurSaisie("Lie d'abord l'activité à une édition de Thé Débat.");
  await enregistrer(activiteId, l.a.debatEditionId);
}

async function enregistrer(activiteId: string, editionId: string) {
  const lu = SchemaResultats.safeParse(await appeler(`?edition=${encodeURIComponent(editionId)}`));
  if (!lu.success) throw new ErreurSaisie("Réponse de Thé Débat inattendue.");
  await db
    .update(schema.activite)
    .set({ debatEditionId: editionId, debatResultats: lu.data, debatRecupereLe: new Date() })
    .where(eq(schema.activite.id, activiteId));
}

/** Ajoute au bilan de l'activité le texte tiré des résultats (à la suite de ce qui est déjà écrit). */
export async function insererDansBilan(u: Acteur, activiteId: string): Promise<void> {
  const l = await activiteModifiable(u, activiteId);
  if (!l.a.debatResultats) throw new ErreurSaisie("Récupère d'abord les résultats de Thé Débat.");
  const texte = texteBilan(l.a.debatResultats);
  if (!texte) throw new ErreurSaisie("Les résultats ne contiennent encore aucun chiffre à reporter.");
  const bilan = l.a.bilan?.trim();
  await db
    .update(schema.activite)
    .set({ bilan: (bilan ? `${bilan}\n\n${texte}` : texte).slice(0, 8000) })
    .where(eq(schema.activite.id, activiteId));
}
