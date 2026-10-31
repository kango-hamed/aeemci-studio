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
 * - Mandat clos : ses documents et ses activités sont en lecture seule, pour tout le monde. Le bureau du
 *   mandat en cours les lit tous ; les membres d'une délégation lisent ceux de leur délégation.
 * - Activités : tout membre avec un rôle en crée pour sa délégation ; l'auteur, le responsable de la
 *   délégation et le bureau les modifient. Elles se lisent selon leur visibilité, comme un document publié.
 * - Documents administratifs : le président valide et signe ; le vice-président aussi quand le président
 *   a activé l'intérim. Un administrateur de la plateforme ne valide pas : il n'est pas signataire.
 *
 * - Gabarits : les administrateurs et les designers du mandat (cellule communication) les importent, les
 *   règlent et les publient. Un gabarit réservé à des délégations ne sert qu'à leurs membres (et au bureau).
 *
 * `filtreLecture` (documents/requetes.ts) traduit `peutLireDocument` en SQL : les deux vont ensemble.
 */
import { estRoleBureau, type Role } from "./roles";

export interface Acteur {
  id: string;
  estAdministrateur: boolean;
  affectation: { role: Role; delegationId: string | null; designer?: boolean } | null;
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
  /** Rattaché à un mandat clos : lecture seule. */
  fige?: boolean;
}

/** L'auteur, le bureau exécutif et les administrateurs voient tout ce qui touche à un document. */
function aLaMain(u: Acteur, d: Pick<RattachementDocument, "auteurId">): boolean {
  return d.auteurId === u.id || u.estAdministrateur || estBureau(u);
}

/** Changer le titre, le statut ou la visibilité : l'auteur, le bureau exécutif, les administrateurs ; jamais dans un mandat clos. */
export function peutModifierDocument(u: Acteur, d: Pick<RattachementDocument, "auteurId" | "fige">): boolean {
  return !d.fige && aLaMain(u, d);
}

export function peutLireDocument(u: Acteur, d: RattachementDocument): boolean {
  if (aLaMain(u, d)) return true;
  if (d.statut !== "publie") return false;
  if (d.visibilite === "section") return true;
  return d.visibilite === "delegation" && d.delegationId !== null && u.affectation?.delegationId === d.delegationId;
}

/** Valider (ou renvoyer en correction) un document administratif. */
export function peutValider(u: Acteur, interim: boolean): boolean {
  const role = u.affectation?.role;
  return role === "president" || (role === "vice_president" && interim);
}

/** Cachet de la section et intérim : le président et les administrateurs. */
export function peutGererCachet(u: Acteur): boolean {
  return u.estAdministrateur || u.affectation?.role === "president";
}

export interface RattachementActivite {
  auteurId: string;
  delegationId: string | null;
  visibilite: Visibilite;
  fige?: boolean;
}

/** Une activité se lit comme un document publié de même visibilité. */
export function peutLireActivite(u: Acteur, a: RattachementActivite): boolean {
  return peutLireDocument(u, { ...a, statut: "publie" });
}

/** Fiche, bilan, documents et photos d'une activité : l'auteur, le responsable de sa délégation, le bureau. */
export function peutModifierActivite(u: Acteur, a: Pick<RattachementActivite, "auteurId" | "delegationId" | "fige">): boolean {
  if (a.fige) return false;
  if (aLaMain(u, a)) return true;
  return u.affectation?.role === "responsable_delegation" && a.delegationId !== null && u.affectation.delegationId === a.delegationId;
}

/** Clore le mandat et ouvrir le suivant : le président et les administrateurs. */
export function peutCloreMandat(u: Acteur): boolean {
  return u.estAdministrateur || u.affectation?.role === "president";
}

/** Dossier de passation d'une délégation (`null` : le bureau exécutif) : le bureau, ou les membres de la délégation. */
export function peutLirePassation(u: Acteur, delegationId: string | null): boolean {
  if (u.estAdministrateur || estBureau(u)) return true;
  return delegationId !== null && u.affectation?.delegationId === delegationId;
}

/** Points en suspens d'une délégation : son responsable et le bureau. */
export function peutEcrirePassation(u: Acteur, delegationId: string | null): boolean {
  if (u.estAdministrateur || estBureau(u)) return true;
  return delegationId !== null && u.affectation?.role === "responsable_delegation" && u.affectation.delegationId === delegationId;
}

/** Importer, régler et publier les gabarits. */
export function peutGererGabarits(u: Acteur): boolean {
  return u.estAdministrateur || Boolean(u.affectation?.designer);
}

/** Créer un document avec un gabarit, réservé ou non (`delegations` vide : toute la section). */
export function peutUtiliserGabarit(u: Acteur, delegations: string[]): boolean {
  if (!delegations.length || peutGererGabarits(u) || estBureau(u)) return true;
  return Boolean(u.affectation?.delegationId && delegations.includes(u.affectation.delegationId));
}
