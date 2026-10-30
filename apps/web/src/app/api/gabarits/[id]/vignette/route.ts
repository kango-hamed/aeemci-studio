import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";
import { vignetteDuGabarit } from "@/fonctionnalites/gabarits/requetes";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const cle = await vignetteDuGabarit((await params).id);
  const contenu = cle ? await stockage().lire(cle) : null;
  return contenu ? fichier(contenu, "image/jpeg") : erreur(404, "Pas de vignette.");
}
