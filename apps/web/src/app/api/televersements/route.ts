import { randomUUID } from "node:crypto";
import { db, schema } from "@/serveur/db";
import { erreur, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const TAILLE_MAX = 10 * 1024 * 1024;

/** Photo choisie dans le formulaire (réduite par le navigateur avant l'envoi). Réponse : `{ id }`. */
export async function POST(request: Request) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!photo || typeof photo === "string") return erreur(400, "Aucune photo reçue.");
  const ext = TYPES[photo.type];
  if (!ext) return erreur(415, "Format non pris en charge : choisis une photo JPEG, PNG ou WebP.");
  if (photo.size > TAILLE_MAX) return erreur(413, "Photo trop lourde (10 Mo au plus).");
  const contenu = Buffer.from(await photo.arrayBuffer());
  const id = randomUUID();
  const cle = `televersements/${u.id}/${id}.${ext}`;
  await stockage().ecrire(cle, contenu, photo.type);
  await db.insert(schema.televersement).values({ id, userId: u.id, cle, type: photo.type, taille: contenu.length });
  return Response.json({ id });
}
