import { z } from "zod";
import { ErreurRendu, type Gabarit } from "@aeemci-studio/moteur";
import { erreur, membreOuRefus } from "@/serveur/reponses";
import { apercuBrouillon, ErreurGabarit } from "@/fonctionnalites/gabarits/atelier";

const Demande = z.object({
  contenu: z.object({ champs: z.array(z.any()), plans: z.array(z.any()) }).passthrough(),
  mode: z.enum(["exemple", "long", "perso"]),
  valeurs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  plan: z.string().max(80).optional(),
});

/** Aperçu du brouillon d'un gabarit avec les réglages en cours (écran du gabarit). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const d = Demande.safeParse(await request.json().catch(() => null));
  if (!d.success) return erreur(400, "Demande d'aperçu invalide.");
  try {
    const r = await apercuBrouillon(u, (await params).id, { ...d.data, contenu: d.data.contenu as unknown as Gabarit });
    return new Response(new Uint8Array(r.fichier), {
      headers: { "content-type": r.type, "cache-control": "no-store", "x-rapport": Buffer.from(JSON.stringify(r.rapport), "utf8").toString("base64") },
    });
  } catch (e) {
    if (e instanceof ErreurGabarit) return erreur(e.message.startsWith("Réservé") ? 403 : 422, e.message);
    if (e instanceof ErreurRendu) return erreur(422, e.message, { erreurs: e.erreurs });
    throw e;
  }
}
