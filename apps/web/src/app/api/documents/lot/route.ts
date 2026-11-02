import { z } from "zod";
import { PHOTO_ESSAI, validerValeurs, type Valeurs } from "@aeemci-studio/moteur";
import { erreur, createurOuRefus } from "@/serveur/reponses";
import { gabaritACompleter } from "@/fonctionnalites/gabarits/requetes";
import { MAX_LIGNES_LOT } from "@/fonctionnalites/generation/lot";

const Demande = z.object({
  gabaritId: z.string(),
  lignes: z
    .array(z.object({ valeurs: z.record(z.string(), z.string().max(2000)), images: z.array(z.string()) }))
    .min(1)
    .max(MAX_LIGNES_LOT),
});

/**
 * Contrôle des lignes d'un lot avant la création : les mêmes règles que le formulaire (obligatoire,
 * date, nombre, bornes de la jauge, longueur refusée). Une photo trouvée compte comme remplie.
 * Réponse : `{ erreurs }`, une liste par ligne. Rien n'est enregistré.
 */
export async function POST(request: Request) {
  const u = await createurOuRefus();
  if (u instanceof Response) return u;
  const d = Demande.safeParse(await request.json().catch(() => null));
  if (!d.success) return erreur(400, "Demande invalide.");
  const g = await gabaritACompleter(d.data.gabaritId, u);
  if (!g) return erreur(404, "Ce gabarit n'est plus disponible.");
  const gabarit = g.revision.contenu;
  const erreurs = d.data.lignes.map((l) => {
    const valeurs: Valeurs = { ...l.valeurs };
    for (const c of gabarit.champs) if (c.type === "image") valeurs[c.nom] = l.images.includes(c.nom) ? PHOTO_ESSAI : null;
    // Le formulaire parle d'AAAA-MM-JJ (champ date du navigateur) ; dans un fichier, on écrit la date à la française.
    return validerValeurs(gabarit, valeurs).map((e) => {
      const c = gabarit.champs.find((x) => x.nom === e.champ);
      return c?.type === "date" && l.valeurs[c.nom] ? { ...e, message: `« ${c.libelle || c.nom} » : date illisible (« ${l.valeurs[c.nom]} »). Écris-la 15/11/2026.` } : e;
    });
  });
  return Response.json({ revisionId: g.revision.id, erreurs });
}
