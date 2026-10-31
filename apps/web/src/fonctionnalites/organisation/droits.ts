/**
 * Droits des membres, calculés à partir du rôle dans le mandat en cours (jamais de la personne).
 * Fonctions pures : la couche d'accès (requêtes, actions, routes) les appelle avant toute lecture ou écriture.
 *
 * - Bureau exécutif (président, vice-président, secrétaire général) et administrateurs : gèrent
 *   l'organisation, lisent et modifient tous les documents, brouillons compris.
 * - Un document publié se lit selon sa visibilité : « délégation » (membres de la délégation de
 *   l'auteur), « section » (tout membre connecté), « bureau » (personne de plus). Un brouillon ne se lit
 *   que par son auteur et le bureau.
 * - Sans rôle dans le mandat en cours : ne crée plus rien, garde la lecture de ses propres documents.
 *
 * `filtreLecture` (documents/requetes.ts) traduit `peutLireDocument` en SQL : les deux vont ensemble.
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

export type Visibilite = "bureau" | "delegation" | "section";
export type StatutDocument = "brouillon" | "publie";

export interface RattachementDocument {
  auteurId: string;
  delegationId: string | null;
  statut: StatutDocument;
  visibilite: Visibilite;
}

/** Changer le titre, le statut ou la visibilité : l'auteur, le bureau exécutif, les administrateurs. */
export function peutModifierDocument(u: Acteur, d: Pick<RattachementDocument, "auteurId">): boolean {
  return d.auteurId === u.id || u.estAdministrateur || estBureau(u);
}

export function peutLireDocument(u: Acteur, d: RattachementDocument): boolean {
  if (peutModifierDocument(u, d)) return true;
  if (d.statut !== "publie") return false;
  if (d.visibilite === "section") return true;
  return d.visibilite === "delegation" && d.delegationId !== null && u.affectation?.delegationId === d.delegationId;
}
