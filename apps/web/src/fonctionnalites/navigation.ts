/**
 * Entrées du menu principal. Chaque fonctionnalité ajoute la sienne ici quand elle est livrée.
 */
export interface EntreeNavigation {
  href: string;
  libelle: string;
  /** Autres chemins qui rendent l'entrée active. */
  aussi?: string[];
  /** Réservé aux administrateurs de la plateforme, ou à ceux qui gèrent l'organisation (bureau exécutif). */
  reserve?: "administrateur" | "organisation";
  /** Libellé pour le président (ou le vice-président en intérim), avec le nombre de documents qui l'attendent. */
  libelleValideur?: string;
}

export const NAVIGATION: EntreeNavigation[] = [
  { href: "/", libelle: "Accueil" },
  { href: "/gabarits", libelle: "Créer", aussi: ["/creer"] },
  { href: "/documents", libelle: "Documents" },
  { href: "/a-valider", libelle: "Officiels", libelleValideur: "À valider", aussi: ["/rediger", "/signature"] },
  { href: "/activites", libelle: "Activités" },
  { href: "/archives", libelle: "Archives", aussi: ["/passation"] },
  { href: "/organisation", libelle: "Organisation", reserve: "organisation" },
];
