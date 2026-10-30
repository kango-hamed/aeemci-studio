import "server-only";
import { utilisateurCourant, type Utilisateur } from "@/fonctionnalites/authentification/session";
import { peutCreerDocuments } from "@/fonctionnalites/organisation/droits";

/** Réponse d'erreur JSON homogène pour les routes d'API : `{ message, details? }`. */
export function erreur(status: number, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ message, ...extra }, { status });
}

/** Membre connecté, ou réponse 401 à renvoyer telle quelle. */
export async function membreOuRefus(): Promise<Utilisateur | Response> {
  const u = await utilisateurCourant();
  return u ?? erreur(401, "Connexion requise.");
}

/** Membre connecté qui peut créer (rôle dans le mandat en cours), ou réponse 401/403. */
export async function createurOuRefus(): Promise<Utilisateur | Response> {
  const u = await utilisateurCourant();
  if (!u) return erreur(401, "Connexion requise.");
  if (!peutCreerDocuments(u)) return erreur(403, MESSAGE_SANS_ROLE);
  return u;
}

export const MESSAGE_SANS_ROLE = "Tu n'as pas de rôle dans le mandat en cours : demande au bureau de t'en attribuer un pour créer des documents.";

/** Fichier binaire privé : jamais mis en cache par un intermédiaire. */
export function fichier(contenu: Buffer, type: string, nom?: string, telecharger = false) {
  const entetes: Record<string, string> = { "content-type": type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" };
  if (nom) entetes["content-disposition"] = `${telecharger ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(nom)}`;
  return new Response(new Uint8Array(contenu), { headers: entetes });
}
