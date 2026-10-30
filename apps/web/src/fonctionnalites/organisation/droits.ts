/**
 * Droits des membres, calculés à partir du rôle dans le mandat en cours (jamais de la personne).
 * Fonctions pures : la couche d'accès (requêtes, actions, routes) les appelle avant toute lecture ou écriture.
 *
 * - Bureau exécutif (président, vice-président, secrétaire général) et administrateurs : gèrent
 *   l'organisation et lisent tous les documents.
 * - Membre d'une délégation : lit les documents de sa délégation.
 * - Sans rôle dans le mandat en cours : ne crée plus rien, garde la lecture de ses propres documents.
 */
import { estRoleBureau, type Role } from "./roles";

export interface Acteur {
  id: string;
  estAdministrateur: boolean;
  affectation: { role: Role; delegationId: string | null } | null;
}

export function estBureau(u: Acteur): boolean {
  return Boolean(u.affectation && estRoleBureau(u.affectation.role));
}

/** Créer et modifier les comptes, les rôles et les délégations. */
export function peutGererOrganisation(u: Acteur): boolean {
  return u.estAdministrateur || estBureau(u);
}

/** Seuls le président et les administrateurs donnent ou retirent le rôle de président. */
export function peutToucherAuPresident(u: Acteur): boolean {
  return u.estAdministrateur || u.affectation?.role === "president";
}

/** Créer des documents (aperçus, photos, fichiers) : il faut un rôle dans le mandat en cours. */
export function peutCreerDocuments(u: Acteur): boolean {
  return u.estAdministrateur || u.affectation !== null;
}

export interface RattachementDocument {
  auteurId: string;
  delegationId: string | null;
}

export function peutLireDocument(u: Acteur, d: RattachementDocument): boolean {
  if (d.auteurId === u.id || u.estAdministrateur || estBureau(u)) return true;
  return d.delegationId !== null && u.affectation?.delegationId === d.delegationId;
}
