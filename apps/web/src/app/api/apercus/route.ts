import { z } from "zod";
import { ErreurRendu } from "@aeemci-studio/moteur";
import { erreur, createurOuRefus, reponseOccupe } from "@/serveur/reponses";
import { rendre } from "@/fonctionnalites/generation/rendu";
import { preparerValeurs } from "@/fonctionnalites/generation/valeurs";
import { gabaritACompleter } from "@/fonctionnalites/gabarits/requetes";

const Demande = z.object({
  gabaritId: z.string(),
  plan: z.string().optional(),
  valeurs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  /** Faux pour une ligne de lot : un champ vide reste vide, comme dans le document créé. */
  exemples: z.boolean().optional(),
});

/** Aperçu en cours de saisie : petite taille, rien n'est enregistré, champs vides remplis par l'exemple (sauf `exemples: false`). */
export async function POST(request: Request) {
  const u = await createurOuRefus();
  if (u instanceof Response) return u;
  const d = Demande.safeParse(await request.json().catch(() => null));
  if (!d.success) return erreur(400, "Demande d'aperçu invalide.");
  const g = await gabaritACompleter(d.data.gabaritId, u);
  if (!g) return erreur(404, "Ce gabarit n'est plus disponible.");
  try {
    const valeurs = await preparerValeurs(g.revision.contenu, d.data.valeurs, u.id, d.data.exemples !== false);
    const r = await rendre({ revision: g.revision, valeurs: valeurs.moteur, plan: d.data.plan, format: "jpeg", largeurMax: 720, compte: u.id, remplacable: true });
    return new Response(new Uint8Array(r.fichier), {
      headers: {
        "content-type": r.type,
        "cache-control": "no-store",
        "x-revision": g.revision.id,
        "x-rapport": Buffer.from(JSON.stringify(r.rapport), "utf8").toString("base64"),
      },
    });
  } catch (e) {
    if (e instanceof ErreurRendu) return erreur(422, e.message, { erreurs: e.erreurs });
    const occupe = reponseOccupe(e);
    if (occupe) return occupe;
    throw e;
  }
}
