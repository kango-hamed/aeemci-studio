import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { ErreurSaisie, visibiliteEffective } from "@/fonctionnalites/documents/creer";
import { documentLisible } from "@/fonctionnalites/documents/requetes";
import { estBureau, peutCreerDocuments, peutModifierActivite, peutModifierDocument, type Acteur, type Visibilite } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";
import { activiteLisible } from "./requetes";

/**
 * Activités : création par tout membre avec un rôle, pour sa délégation (le bureau choisit la délégation,
 * ou aucune) ; fiche et bilan modifiés par l'auteur, le responsable de la délégation et le bureau.
 * Un document (affiche, PV, photos…) se rattache à une activité de son mandat.
 */

export interface SaisieActivite {
  titre: string;
  date: string;
  heure?: string;
  lieu?: string;
  description?: string;
  bilan?: string;
  visibilite?: Visibilite;
  /** Pour le bureau seulement : la délégation qui organise (vide : le bureau exécutif). */
  delegationId?: string | null;
}

const texte = (v: string | undefined, max: number) => {
  const t = v?.replace(/\r\n?/g, "\n").trim();
  return t ? t.slice(0, max) : null;
};

function verifier(s: SaisieActivite) {
  const titre = s.titre?.trim().replace(/\s+/g, " ") ?? "";
  if (titre.length < 2) throw new ErreurSaisie("Donne un titre à l'activité.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? "") || Number.isNaN(Date.parse(s.date))) throw new ErreurSaisie("Indique la date de l'activité.");
  if (s.heure && !/^\d{2}:\d{2}$/.test(s.heure)) throw new ErreurSaisie("Heure invalide.");
  return {
    titre: titre.slice(0, 200),
    date: s.date,
    heure: s.heure || null,
    lieu: texte(s.lieu, 200),
    description: texte(s.description, 4000),
    bilan: texte(s.bilan, 8000),
  };
}

/** Délégation de l'activité : celle du membre, ou au choix du bureau parmi celles de la section. */
async function delegationDe(u: Acteur, sectionId: string, demandee: string | null | undefined): Promise<string | null> {
  if (!(u.estAdministrateur || estBureau(u))) return u.affectation?.delegationId ?? null;
  if (!demandee) return null;
  const [d] = await db
    .select({ id: schema.delegation.id })
    .from(schema.delegation)
    .where(and(eq(schema.delegation.id, demandee), eq(schema.delegation.sectionId, sectionId)));
  if (!d) throw new ErreurSaisie("Délégation inconnue.");
  return d.id;
}

export async function creerActivite(u: Acteur, s: SaisieActivite): Promise<{ id: string }> {
  if (!peutCreerDocuments(u)) throw new ErreurSaisie("Tu n'as pas de rôle dans le mandat en cours.");
  const m = await mandatCourant();
  if (!m) throw new ErreurSaisie("Aucun mandat en cours.");
  const champs = verifier(s);
  const delegationId = await delegationDe(u, m.sectionId, s.delegationId);
  const [a] = await db
    .insert(schema.activite)
    .values({ ...champs, mandatId: m.id, delegationId, auteurId: u.id, visibilite: visibiliteEffective(s.visibilite ?? "section", delegationId) })
    .returning({ id: schema.activite.id });
  return { id: a!.id };
}

async function activiteModifiable(u: Acteur, id: string) {
  const l = await activiteLisible(id, u);
  if (!l) throw new ErreurSaisie("Activité introuvable.");
  if (l.a.fige) throw new ErreurSaisie("Cette activité appartient à un mandat clos : elle est en lecture seule.");
  if (!peutModifierActivite(u, l.a)) throw new ErreurSaisie("Seuls l'auteur, le responsable de la délégation et le bureau modifient cette activité.");
  return l;
}

export async function modifierActivite(u: Acteur, id: string, s: SaisieActivite): Promise<void> {
  const l = await activiteModifiable(u, id);
  const champs = verifier(s);
  const [mandat] = await db.select({ sectionId: schema.mandat.sectionId }).from(schema.mandat).where(eq(schema.mandat.id, l.a.mandatId));
  const delegationId = s.delegationId === undefined ? l.a.delegationId : await delegationDe(u, mandat!.sectionId, s.delegationId);
  await db
    .update(schema.activite)
    .set({ ...champs, delegationId, visibilite: visibiliteEffective(s.visibilite ?? l.a.visibilite, delegationId) })
    .where(eq(schema.activite.id, id));
}

/** Supprime la fiche ; ses documents restent, sans rattachement. */
export async function supprimerActivite(u: Acteur, id: string): Promise<void> {
  await activiteModifiable(u, id);
  await db.update(schema.document).set({ activiteId: null }).where(eq(schema.document.activiteId, id));
  await db.delete(schema.activite).where(eq(schema.activite.id, id));
}

/**
 * Rattache (ou détache, `activiteId` nul) un document : il faut pouvoir modifier le document, et
 * l'activité visée doit être modifiable et du même mandat.
 */
export async function rattacherDocument(u: Acteur, documentId: string, activiteId: string | null): Promise<void> {
  const doc = await documentLisible(documentId, u);
  if (!doc || !peutModifierDocument(u, doc.d)) throw new ErreurSaisie("Document introuvable.");
  if (activiteId) {
    const l = await activiteModifiable(u, activiteId);
    if (doc.d.mandatId && doc.d.mandatId !== l.a.mandatId) throw new ErreurSaisie("Ce document appartient à un autre mandat.");
  } else if (doc.d.activiteId) {
    await activiteModifiable(u, doc.d.activiteId).catch(() => {
      // L'auteur du document peut toujours le détacher, même sans droit sur l'activité.
      if (doc.d.auteurId !== u.id) throw new ErreurSaisie("Seuls l'auteur, le responsable de la délégation et le bureau modifient cette activité.");
    });
  }
  await db.update(schema.document).set({ activiteId }).where(eq(schema.document.id, documentId));
}

/** Vérifie qu'un dépôt peut être rattaché à l'activité, et renvoie sa visibilité (photos partagées comme l'activité). */
export async function activitePourDepot(u: Acteur, activiteId: string): Promise<{ visibilite: Visibilite; mandatId: string; delegationId: string | null }> {
  const l = await activiteModifiable(u, activiteId);
  return { visibilite: l.a.visibilite, mandatId: l.a.mandatId, delegationId: l.a.delegationId };
}
