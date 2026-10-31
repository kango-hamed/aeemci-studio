import type { Visibilite } from "@/fonctionnalites/organisation/droits";

/** Libellés de visibilité, avec qui lit le document en plus de l'auteur et du bureau exécutif. */
export const VISIBILITES: { valeur: Visibilite; libelle: string; detail: string }[] = [
  { valeur: "delegation", libelle: "Ma délégation", detail: "les membres de ta délégation" },
  { valeur: "section", libelle: "Toute la section", detail: "tous les membres connectés" },
  { valeur: "bureau", libelle: "Bureau exécutif", detail: "personne d'autre que toi et le bureau" },
];

export function libelleVisibilite(v: Visibilite): string {
  return VISIBILITES.find((x) => x.valeur === v)!.libelle;
}

/** Choix proposés : sans délégation (bureau exécutif), « Ma délégation » n'a pas de sens. */
export function visibilitesPour(aUneDelegation: boolean) {
  return VISIBILITES.filter((v) => aUneDelegation || v.valeur !== "delegation");
}
