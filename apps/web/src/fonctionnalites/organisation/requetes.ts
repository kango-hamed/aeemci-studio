import "server-only";
import { and, asc, count, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import type { Role } from "./roles";

export interface AffectationCourante {
  role: Role;
  mandat: string;
  mandatId: string;
  delegation: string | null;
  delegationId: string | null;
  section: string;
  designer: boolean;
}

/** Rôle du membre dans le mandat en cours de sa section, s'il en a un. */
export async function affectationCourante(userId: string): Promise<AffectationCourante | null> {
  const [ligne] = await db
    .select({
      role: schema.affectation.role,
      mandat: schema.mandat.libelle,
      mandatId: schema.mandat.id,
      delegation: schema.delegation.nom,
      delegationId: schema.affectation.delegationId,
      section: schema.section.nom,
      designer: schema.affectation.designer,
    })
    .from(schema.affectation)
    .innerJoin(schema.mandat, eq(schema.affectation.mandatId, schema.mandat.id))
    .innerJoin(schema.section, eq(schema.mandat.sectionId, schema.section.id))
    .leftJoin(schema.delegation, eq(schema.affectation.delegationId, schema.delegation.id))
    .where(and(eq(schema.affectation.userId, userId), eq(schema.mandat.statut, "en_cours")))
    .limit(1);
  return ligne ?? null;
}

export interface MandatCourant {
  id: string;
  libelle: string;
  sectionId: string;
  section: string;
  /** Intérim de la présidence : le vice-président valide les documents administratifs. */
  interim: boolean;
}

/** Mandat en cours de la section (une seule section pour l'instant : ESATIC). */
export async function mandatCourant(): Promise<MandatCourant | null> {
  const [m] = await db
    .select({ id: schema.mandat.id, libelle: schema.mandat.libelle, sectionId: schema.mandat.sectionId, section: schema.section.nom, interim: schema.mandat.interim })
    .from(schema.mandat)
    .innerJoin(schema.section, eq(schema.mandat.sectionId, schema.section.id))
    .where(eq(schema.mandat.statut, "en_cours"))
    .orderBy(sql`${schema.mandat.createdAt} desc`)
    .limit(1);
  return m ?? null;
}

export interface Delegation {
  id: string;
  nom: string;
  /** Code des numéros de documents officiels (« COM »). */
  code: string | null;
  archivee: boolean;
  membres: number;
}

/** Délégations de la section, avec le nombre de membres affectés dans le mandat indiqué. */
export async function delegationsDe(sectionId: string, mandatId: string): Promise<Delegation[]> {
  return db
    .select({
      id: schema.delegation.id,
      nom: schema.delegation.nom,
      code: schema.delegation.code,
      archivee: schema.delegation.archivee,
      membres: count(schema.affectation.id),
    })
    .from(schema.delegation)
    .leftJoin(schema.affectation, and(eq(schema.affectation.delegationId, schema.delegation.id), eq(schema.affectation.mandatId, mandatId)))
    .where(eq(schema.delegation.sectionId, sectionId))
    .groupBy(schema.delegation.id)
    .orderBy(asc(schema.delegation.archivee), asc(schema.delegation.nom));
}

export type EtatCompte = "actif" | "lien_envoye" | "lien_expire" | "sans_lien";

export interface MembreDuMandat {
  userId: string;
  nom: string;
  email: string;
  estAdministrateur: boolean;
  affectationId: string;
  role: Role;
  delegationId: string | null;
  delegation: string | null;
  designer: boolean;
  compte: EtatCompte;
}

export interface AncienMembre {
  userId: string;
  nom: string;
  email: string;
}

/** État du compte : actif dès qu'un mot de passe existe ; sinon, selon le dernier lien remis. */
async function etatsDesComptes(userIds: string[]): Promise<Map<string, EtatCompte>> {
  const etats = new Map<string, EtatCompte>();
  if (!userIds.length) return etats;
  const actifs = await db
    .select({ userId: schema.account.userId })
    .from(schema.account)
    .where(and(inArray(schema.account.userId, userIds), eq(schema.account.providerId, "credential")));
  for (const a of actifs) etats.set(a.userId, "actif");
  const liens = await db
    .select({ userId: schema.invitation.userId, expireLe: sql<Date>`max(${schema.invitation.expireLe})` })
    .from(schema.invitation)
    .where(and(inArray(schema.invitation.userId, userIds), isNull(schema.invitation.utiliseeLe)))
    .groupBy(schema.invitation.userId);
  const maintenant = Date.now();
  for (const l of liens) if (!etats.has(l.userId)) etats.set(l.userId, new Date(l.expireLe).getTime() > maintenant ? "lien_envoye" : "lien_expire");
  for (const id of userIds) if (!etats.has(id)) etats.set(id, "sans_lien");
  return etats;
}

/** Membres affectés au mandat, bureau d'abord puis par délégation et par nom. */
export async function membresDuMandat(mandatId: string): Promise<MembreDuMandat[]> {
  const lignes = await db
    .select({
      userId: schema.user.id,
      nom: schema.user.name,
      email: schema.user.email,
      estAdministrateur: schema.user.estAdministrateur,
      affectationId: schema.affectation.id,
      role: schema.affectation.role,
      delegationId: schema.affectation.delegationId,
      delegation: schema.delegation.nom,
      designer: schema.affectation.designer,
    })
    .from(schema.affectation)
    .innerJoin(schema.user, eq(schema.affectation.userId, schema.user.id))
    .leftJoin(schema.delegation, eq(schema.affectation.delegationId, schema.delegation.id))
    .where(eq(schema.affectation.mandatId, mandatId))
    .orderBy(sql`${schema.delegation.nom} nulls first`, asc(schema.affectation.role), asc(schema.user.name));
  const etats = await etatsDesComptes(lignes.map((l) => l.userId));
  return lignes.map((l) => ({ ...l, compte: etats.get(l.userId)! }));
}

/** Comptes sans rôle dans le mandat (anciens membres) : ils gardent la lecture de leurs documents. */
export async function anciensMembres(mandatId: string): Promise<AncienMembre[]> {
  const affectes = db.select({ id: schema.affectation.userId }).from(schema.affectation).where(eq(schema.affectation.mandatId, mandatId));
  return db
    .select({ userId: schema.user.id, nom: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(and(notInArray(schema.user.id, affectes), eq(schema.user.estAdministrateur, false)))
    .orderBy(asc(schema.user.name));
}
