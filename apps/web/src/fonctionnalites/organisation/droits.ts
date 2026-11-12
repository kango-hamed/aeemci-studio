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
 * - Activités : tout membre avec un rôle en crée pour sa délégation ; l'auteur, le responsable et les
 *   sous-responsables de la délégation et le bureau les modifient. Elles se lisent selon leur visibilité, comme un document publié.
 *   Comité d'organisation (lot 10a) : le bureau nomme le PCO et son adjoint, qui gèrent l'activité comme son
 *   auteur ; le PCO (et le bureau) choisit les membres du comité, qui lisent l'activité et y ajoutent documents,
 *   photos et lettres. La suppression reste à l'auteur, aux responsables de la délégation et au bureau.
 * - Documents administratifs : le président valide et signe ; pendant l'intérim, le vice-président qu'il
 *   a désigné aussi (un seul). Un administrateur de la plateforme ne valide pas : il n'est pas signataire.
 *
 * - Gabarits : les administrateurs et les designers du mandat (cellule communication) les importent, les
 *   règlent et les publient. Un gabarit réservé à des délégations ne sert qu'à leurs membres (et au bureau).
 *
 * `filtreLecture` (documents/requetes.ts) traduit `peutLireDocument` en SQL : les deux vont ensemble.
 */
import { dirigeDelegation, estRoleBureau, type Role } from "./roles";

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

/**
 * Valider (ou renvoyer en correction) un document administratif : le président, ou le vice-président
 * qu'il a désigné pour l'intérim (`interimaire` : son identifiant, null hors intérim).
 */
export function peutValider(u: Acteur, interimaire: string | null): boolean {
  const role = u.affectation?.role;
  return role === "president" || (role === "vice_president" && interimaire === u.id);
}

/** Cachet de la section et intérim : le président et les administrateurs. */
export function peutGererCachet(u: Acteur): boolean {
  return u.estAdministrateur || u.affectation?.role === "president";
}

/** Place dans le comité d'organisation d'une activité. */
export type RoleComite = "pco" | "adjoint" | "membre";

export interface RattachementActivite {
  auteurId: string;
  delegationId: string | null;
  visibilite: Visibilite;
  fige?: boolean;
  /** Place de l'acteur dans le comité de cette activité (`null` ou absent : il n'en fait pas partie). */
  comite?: RoleComite | null;
}

/** Une activité se lit comme un document publié de même visibilité ; les membres de son comité la lisent toujours. */
export function peutLireActivite(u: Acteur, a: RattachementActivite): boolean {
  return Boolean(a.comite) || peutLireDocument(u, { ...a, statut: "publie" });
}

/** L'auteur, le responsable et les sous-responsables de la délégation de l'activité, le bureau. */
function dirigeActivite(u: Acteur, a: Pick<RattachementActivite, "auteurId" | "delegationId">): boolean {
  if (aLaMain(u, a)) return true;
  return dirigeDelegation(u.affectation?.role) && a.delegationId !== null && u.affectation!.delegationId === a.delegationId;
}

/** Fiche et bilan d'une activité : ceux qui la dirigent, et son PCO et son adjoint. */
export function peutModifierActivite(u: Acteur, a: Pick<RattachementActivite, "auteurId" | "delegationId" | "fige" | "comite">): boolean {
  if (a.fige) return false;
  return a.comite === "pco" || a.comite === "adjoint" || dirigeActivite(u, a);
}

/** Documents, photos et lettres rattachés à une activité : ceux qui la modifient et tout son comité. */
export function peutContribuerActivite(u: Acteur, a: Pick<RattachementActivite, "auteurId" | "delegationId" | "fige" | "comite">): boolean {
  return !a.fige && (Boolean(a.comite) || peutModifierActivite(u, a));
}

/** Supprimer la fiche : son auteur, les responsables de sa délégation et le bureau (pas le comité). */
export function peutSupprimerActivite(u: Acteur, a: Pick<RattachementActivite, "auteurId" | "delegationId" | "fige">): boolean {
  return !a.fige && dirigeActivite(u, a);
}

/** Nommer, remplacer ou retirer le PCO et son adjoint : le bureau exécutif et les administrateurs. */
export function peutNommerPco(u: Acteur, a: Pick<RattachementActivite, "fige">): boolean {
  return !a.fige && (u.estAdministrateur || estBureau(u));
}

/** Ajouter ou retirer des membres du comité : le PCO, le bureau et les administrateurs. */
export function peutComposerComite(u: Acteur, a: Pick<RattachementActivite, "fige" | "comite">): boolean {
  return !a.fige && (a.comite === "pco" || u.estAdministrateur || estBureau(u));
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

/** Points en suspens d'une délégation : son responsable, ses sous-responsables et le bureau. */
export function peutEcrirePassation(u: Acteur, delegationId: string | null): boolean {
  if (u.estAdministrateur || estBureau(u)) return true;
  return delegationId !== null && dirigeDelegation(u.affectation?.role) && u.affectation!.delegationId === delegationId;
}

/**
 * Suppression définitive d'un document ou d'un gabarit : les administrateurs de la plateforme seulement.
 * Les autres masquent (brouillon, visibilité « Bureau exécutif », gabarit non proposé aux membres).
 */
export function peutSupprimerDefinitivement(u: Acteur): boolean {
  return u.estAdministrateur;
}

/** Mot à recopier pour confirmer une suppression définitive. */
export const MOT_CONFIRMATION = "SUPPRIMER";

/**
 * Ce qui interdit de supprimer un document, même pour un administrateur (`null` : rien) : un document
 * officiel validé est numéroté sans trou et archivé ; un mandat clos est en lecture seule.
 */
export function refusSuppressionDocument(d: { etatValidation: string | null; numero: string | null; fige?: boolean }): string | null {
  if (d.etatValidation === "valide" || d.numero) return "Un document officiel validé est numéroté et archivé : il ne se supprime pas. Corrige-le (nouvelle version) ou masque-le.";
  if (d.fige) return "Ce document appartient à un mandat clos, archivé en lecture seule.";
  return null;
}

/**
 * Ce qui interdit de supprimer un gabarit (`null` : rien) : il doit d'abord être retiré des membres, et
 * aucun document ne doit en dépendre (chaque document se refait depuis la révision de son gabarit).
 */
export function refusSuppressionGabarit(g: { actif: boolean; publie: boolean; documents: number }): string | null {
  if (g.documents > 0)
    return `${g.documents} document${g.documents > 1 ? "s ont été faits" : " a été fait"} avec ce gabarit et en dépend${g.documents > 1 ? "ent" : ""} : supprime-les d'abord, ou retire simplement le gabarit des membres.`;
  if (g.actif && g.publie) return "Retire d'abord le gabarit des membres (décoche « Proposé aux membres » dans la fiche).";
  return null;
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
