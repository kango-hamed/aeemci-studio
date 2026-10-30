/**
 * Entrées du menu principal. Chaque fonctionnalité ajoute la sienne ici quand elle est livrée
 * (lot 4 : « À valider », lot 5 : « Activités », « Archives »).
 */
export interface EntreeNavigation {
  href: string;
  libelle: string;
  /** Autres chemins qui rendent l'entrée active. */
  aussi?: string[];
  /** Réservé aux administrateurs de la plateforme. */
  administrateur?: boolean;
}

export const NAVIGATION: EntreeNavigation[] = [
  { href: "/", libelle: "Accueil" },
  { href: "/gabarits", libelle: "Créer", aussi: ["/creer"] },
  { href: "/documents", libelle: "Mes documents" },
];
