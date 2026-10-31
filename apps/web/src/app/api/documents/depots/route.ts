import { z } from "zod";
import { erreur, createurOuRefus } from "@/serveur/reponses";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { deposerDocument, TAILLE_MAX_DEPOT } from "@/fonctionnalites/documents/deposer";

const Champs = z.object({
  titre: z.string().max(200).optional(),
  statut: z.enum(["brouillon", "publie"]).optional(),
  visibilite: z.enum(["bureau", "delegation", "section"]).optional(),
  largeur: z.coerce.number().int().optional(),
  hauteur: z.coerce.number().int().optional(),
});

/**
 * Dépôt d'un fichier existant (PDF, image, scan), en `multipart/form-data` : `fichier`, et pour une image
 * une `miniature` JPEG préparée par le navigateur avec `largeur` et `hauteur`. Réponse : `{ id }`.
 */
export async function POST(request: Request) {
  const u = await createurOuRefus();
  if (u instanceof Response) return u;
  if (Number(request.headers.get("content-length") ?? 0) > TAILLE_MAX_DEPOT + 1024 * 1024) return erreur(413, "Fichier trop lourd (20 Mo au plus).");
  const form = await request.formData().catch(() => null);
  const fichier = form?.get("fichier");
  if (!form || !fichier || typeof fichier === "string") return erreur(400, "Aucun fichier reçu.");
  const texte = (nom: string) => (typeof form.get(nom) === "string" && form.get(nom) !== "" ? String(form.get(nom)) : undefined);
  const c = Champs.safeParse({ titre: texte("titre"), statut: texte("statut"), visibilite: texte("visibilite"), largeur: texte("largeur"), hauteur: texte("hauteur") });
  if (!c.success) return erreur(400, "Demande invalide.");
  const miniature = form.get("miniature");
  try {
    const r = await deposerDocument(
      {
        contenu: Buffer.from(await fichier.arrayBuffer()),
        nomFichier: fichier.name,
        miniature: miniature && typeof miniature !== "string" ? Buffer.from(await miniature.arrayBuffer()) : undefined,
        ...c.data,
      },
      u.id,
      { mandatId: u.affectation?.mandatId ?? null, delegationId: u.affectation?.delegationId ?? null },
    );
    return Response.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof ErreurSaisie) return erreur(422, e.message);
    throw e;
  }
}
