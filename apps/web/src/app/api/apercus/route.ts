import { z } from "zod";
import { ErreurRendu } from "@aeemci-studio/moteur";
import { erreur, membreOuRefus } from "@/serveur/reponses";
import { rendre } from "@/fonctionnalites/generation/rendu";
import { preparerValeurs } from "@/fonctionnalites/generation/valeurs";
import { gabaritACompleter } from "@/fonctionnalites/gabarits/requetes";

const Demande = z.object({
  gabaritId: z.string(),
  plan: z.string().optional(),
  valeurs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

/** Aperçu en cours de saisie : petite taille, rien n'est enregistré, champs vides remplis par l'exemple. */
export async function POST(request: Request) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const d = Demande.safeParse(await request.json().catch(() => null));
  if (!d.success) return erreur(400, "Demande d'aperçu invalide.");
  const g = await gabaritACompleter(d.data.gabaritId);
  if (!g) return erreur(404, "Ce gabarit n'est plus disponible.");
  try {
    const valeurs = await preparerValeurs(g.revision.contenu, d.data.valeurs, u.id, true);
    const r = await rendre({ revision: g.revision, valeurs: valeurs.moteur, plan: d.data.plan, format: "jpeg", largeurMax: 720 });
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
    throw e;
  }
}
