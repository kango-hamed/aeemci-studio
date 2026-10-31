import { z } from "zod";
import { erreur, createurOuRefus } from "@/serveur/reponses";
import { creerDocument, ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { gabaritACompleter } from "@/fonctionnalites/gabarits/requetes";

const Demande = z.object({
  gabaritId: z.string(),
  revisionId: z.string(),
  plan: z.string().optional(),
  titre: z.string().max(200).optional(),
  valeurs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  statut: z.enum(["brouillon", "publie"]).optional(),
  visibilite: z.enum(["bureau", "delegation", "section"]).optional(),
});

/** Crée le document : rendu final, enregistrement du fichier et des valeurs. Réponse : `{ id }`. */
export async function POST(request: Request) {
  const u = await createurOuRefus();
  if (u instanceof Response) return u;
  const d = Demande.safeParse(await request.json().catch(() => null));
  if (!d.success) return erreur(400, "Demande invalide.");
  // Gabarit réservé à d'autres délégations : comme s'il n'existait pas.
  if (!(await gabaritACompleter(d.data.gabaritId, u))) return erreur(422, "Ce gabarit n'est plus disponible.");
  try {
    return Response.json(await creerDocument(d.data, u.id, { mandatId: u.affectation?.mandatId ?? null, delegationId: u.affectation?.delegationId ?? null, statut: d.data.statut, visibilite: d.data.visibilite }), { status: 201 });
  } catch (e) {
    if (e instanceof ErreurSaisie) return erreur(422, e.message, { erreurs: e.erreurs });
    throw e;
  }
}
