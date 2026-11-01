import { timingSafeEqual } from "node:crypto";
import { erreur } from "@/serveur/reponses";
import { envoyerRappels } from "@/fonctionnalites/notifications/evenements";

/**
 * Rappels des activités du lendemain. Appelé une fois par jour par le planificateur (Cloud Scheduler,
 * doc 10), avec l'en-tête `Authorization: Bearer <RAPPELS_SECRET>`. Réponse : `{ activites }`.
 */
export async function POST(request: Request) {
  const secret = process.env.RAPPELS_SECRET;
  if (!secret) return erreur(503, "Rappels non configurés.");
  const recu = Buffer.from(request.headers.get("authorization") ?? "");
  const attendu = Buffer.from(`Bearer ${secret}`);
  if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) return erreur(401, "Accès refusé.");
  return Response.json({ activites: await envoyerRappels() });
}
