import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/serveur/auth";
import { affectationCourante, type AffectationCourante } from "@/fonctionnalites/organisation/requetes";

export interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  estAdministrateur: boolean;
  affectation: AffectationCourante | null;
}

/**
 * Couche d'accès : lit et vérifie la session côté serveur, une fois par requête.
 * Le `proxy` ne fait qu'une redirection rapide sur la présence du cookie ; c'est ici que la session
 * est réellement vérifiée. Toute page, action ou route qui touche à des données passe par ici.
 */
export const utilisateurCourant = cache(async (): Promise<Utilisateur | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return {
    id: s.user.id,
    nom: s.user.name,
    email: s.user.email,
    estAdministrateur: Boolean(s.user.estAdministrateur),
    affectation: await affectationCourante(s.user.id),
  };
});

/** Comme `utilisateurCourant`, mais renvoie vers la connexion si personne n'est connecté. */
export async function exigerUtilisateur(): Promise<Utilisateur> {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  return u;
}
