import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";
import type { Visibilite } from "@/fonctionnalites/organisation/droits";
import { notificationsConfigurees, notifier } from "./envoi";

/**
 * Les quatre notifications de la plateforme et leurs destinataires, tous pris dans le mandat en cours :
 *
 * - document soumis : au président, ou au vice-président quand l'intérim est activé ;
 * - document validé ou à corriger : à son auteur ;
 * - document publié : aux membres à qui sa visibilité s'adresse (sa délégation, toute la section ou le bureau), sauf l'auteur ;
 * - rappel la veille d'une activité : aux membres à qui elle s'adresse, auteur compris.
 */

const ROLES_BUREAU = ["president", "vice_president", "secretaire_general"] as const;

/** Qui valide en ce moment. */
export async function valideurs(): Promise<string[]> {
  const m = await mandatCourant();
  if (!m) return [];
  const a = schema.affectation;
  const lignes = await db
    .select({ id: a.userId })
    .from(a)
    .where(and(eq(a.mandatId, m.id), m.interim ? inArray(a.role, ["president", "vice_president"]) : eq(a.role, "president")));
  return lignes.map((l) => l.id);
}

/**
 * Membres du mandat en cours à qui s'adresse un contenu de cette visibilité. « Délégation » : ses membres
 * seulement ; le bureau, qui lit tout, n'est pas prévenu de chaque document des délégations.
 */
export async function membresVises(visibilite: Visibilite, delegationId: string | null, mandatId: string): Promise<string[]> {
  const a = schema.affectation;
  const portee =
    visibilite === "section" ? undefined : visibilite === "delegation" && delegationId ? eq(a.delegationId, delegationId) : inArray(a.role, [...ROLES_BUREAU]);
  const lignes = await db.select({ id: a.userId }).from(a).where(and(eq(a.mandatId, mandatId), portee));
  return lignes.map((l) => l.id);
}

async function documentPourNotification(id: string) {
  const [d] = await db
    .select({
      id: schema.document.id,
      titre: schema.document.titre,
      auteurId: schema.document.auteurId,
      auteur: schema.user.name,
      statut: schema.document.statut,
      visibilite: schema.document.visibilite,
      delegationId: schema.document.delegationId,
      mandatId: schema.document.mandatId,
      numero: schema.document.numero,
    })
    .from(schema.document)
    .innerJoin(schema.user, eq(schema.document.auteurId, schema.user.id))
    .where(eq(schema.document.id, id));
  return d ?? null;
}

const court = (t: string) => (t.length > 80 ? t.slice(0, 79) + "…" : t);

export async function notifierSoumission(documentId: string): Promise<void> {
  if (!notificationsConfigurees()) return;
  const d = await documentPourNotification(documentId);
  if (!d) return;
  await notifier(await valideurs(), "aValider", {
    titre: "Document à valider",
    corps: `${d.auteur} a soumis « ${court(d.titre)} ».`,
    url: `/documents/${d.id}`,
    etiquette: `valider-${d.id}`,
  });
}

export async function notifierDecision(documentId: string, decision: "valide" | "correction", commentaire?: string): Promise<void> {
  if (!notificationsConfigurees()) return;
  const d = await documentPourNotification(documentId);
  if (!d) return;
  await notifier([d.auteurId], "decision", {
    titre: decision === "valide" ? "Document validé" : "Document à corriger",
    corps: decision === "valide" ? `« ${court(d.titre)} » est validé et signé${d.numero ? ` (n° ${d.numero})` : ""}.` : `« ${court(d.titre)} » : ${court(commentaire ?? "")}`,
    url: decision === "valide" ? `/documents/${d.id}` : `/rediger/${d.id}`,
    etiquette: `decision-${d.id}`,
  });
}

/** Un document vient d'être publié (créé publié, passé de brouillon à publié, ou validé). */
export async function notifierPublication(documentId: string): Promise<void> {
  if (!notificationsConfigurees()) return;
  const d = await documentPourNotification(documentId);
  const m = await mandatCourant();
  if (!d || d.statut !== "publie" || !m || d.mandatId !== m.id) return;
  const vises = (await membresVises(d.visibilite, d.delegationId, m.id)).filter((id) => id !== d.auteurId);
  await notifier(vises, "partage", {
    titre: "Nouveau document",
    corps: `${d.auteur} a partagé « ${court(d.titre)} ».`,
    url: `/documents/${d.id}`,
    // Une série de dépôts du même membre ne laisse qu'une notification sur le téléphone.
    etiquette: `partage-${d.auteurId}`,
  });
}

/** Lendemain d'une date, au format des dates d'activité (Abidjan : UTC toute l'année). */
export function lendemain(maintenant: Date): string {
  return new Date(maintenant.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Rappels des activités du lendemain, appelé une fois par jour (planificateur). Chaque activité n'est
 * rappelée qu'une fois : la marque est posée avant l'envoi, deux appels simultanés ne doublent rien.
 */
export async function envoyerRappels(maintenant = new Date()): Promise<number> {
  const m = await mandatCourant();
  if (!m) return 0;
  const a = schema.activite;
  const activites = await db
    .update(a)
    .set({ rappelEnvoyeLe: maintenant })
    .where(and(eq(a.mandatId, m.id), eq(a.date, lendemain(maintenant)), isNull(a.rappelEnvoyeLe)))
    .returning({ id: a.id, titre: a.titre, heure: a.heure, lieu: a.lieu, visibilite: a.visibilite, delegationId: a.delegationId, auteurId: a.auteurId });
  for (const act of activites) {
    const vises = await membresVises(act.visibilite, act.delegationId, m.id);
    await notifier([...vises, act.auteurId], "rappel", {
      titre: `Demain : ${court(act.titre)}`,
      corps: [act.heure, act.lieu].filter(Boolean).join(" · ") || "Rappel de l'activité de demain.",
      url: `/activites/${act.id}`,
      etiquette: `rappel-${act.id}`,
    });
  }
  return activites.length;
}
