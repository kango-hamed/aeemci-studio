import { z } from "zod";
import { erreur, createurOuRefus } from "@/serveur/reponses";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { deposerDocument, TAILLE_MAX_DEPOT } from "@/fonctionnalites/documents/deposer";
import { activitePourDepot } from "@/fonctionnalites/activites/gestion";
import { mandatPourImport } from "@/fonctionnalites/mandats/archives";

const Champs = z.object({
  titre: z.string().max(200).optional(),
  statut: z.enum(["brouillon", "publie"]).optional(),
  visibilite: z.enum(["bureau", "delegation", "section"]).optional(),
  largeur: z.coerce.number().int().optional(),
  hauteur: z.coerce.number().int().optional(),
  activiteId: z.uuid().optional(),
  /** Import d'archives (bureau) : mandat et délégation (vide : bureau exécutif) choisis. */
  mandatId: z.uuid().optional(),
  delegationId: z.uuid().optional(),
});

/**
 * Dépôt d'un fichier existant (PDF, image, scan), en `multipart/form-data` : `fichier`, et pour une image
 * une `miniature` JPEG préparée par le navigateur avec `largeur` et `hauteur`. Réponse : `{ id }`.
 * `activiteId` : photo ou pièce d'une activité, partagée comme elle. `mandatId` (+ `delegationId`) : import
 * d'anciens dossiers par le bureau, dans un mandat passé.
 */
export async function POST(request: Request) {
  const u = await createurOuRefus();
  if (u instanceof Response) return u;
  if (Number(request.headers.get("content-length") ?? 0) > TAILLE_MAX_DEPOT + 1024 * 1024) return erreur(413, "Fichier trop lourd (20 Mo au plus).");
  const form = await request.formData().catch(() => null);
  const fichier = form?.get("fichier");
  if (!form || !fichier || typeof fichier === "string") return erreur(400, "Aucun fichier reçu.");
  const texte = (nom: string) => (typeof form.get(nom) === "string" && form.get(nom) !== "" ? String(form.get(nom)) : undefined);
  const c = Champs.safeParse({
    titre: texte("titre"),
    statut: texte("statut"),
    visibilite: texte("visibilite"),
    largeur: texte("largeur"),
    hauteur: texte("hauteur"),
    activiteId: texte("activiteId"),
    mandatId: texte("mandatId"),
    delegationId: texte("delegationId"),
  });
  if (!c.success) return erreur(400, "Demande invalide.");
  const { activiteId, mandatId, delegationId, ...depot } = c.data;
  const miniature = form.get("miniature");
  try {
    let rattachement = { mandatId: u.affectation?.mandatId ?? null, delegationId: u.affectation?.delegationId ?? null };
    let visibilite = depot.visibilite;
    if (activiteId) {
      const a = await activitePourDepot(u, activiteId);
      rattachement = { mandatId: a.mandatId, delegationId: a.delegationId };
      visibilite ??= a.visibilite;
    } else if (mandatId) {
      rattachement = await mandatPourImport(u, mandatId, delegationId ?? null);
    }
    const r = await deposerDocument(
      {
        contenu: Buffer.from(await fichier.arrayBuffer()),
        nomFichier: fichier.name,
        miniature: miniature && typeof miniature !== "string" ? Buffer.from(await miniature.arrayBuffer()) : undefined,
        ...depot,
        visibilite,
        activiteId,
      },
      u.id,
      rattachement,
    );
    return Response.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof ErreurSaisie) return erreur(422, e.message);
    throw e;
  }
}
