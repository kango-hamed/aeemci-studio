import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";
import { vignetteAGerer, vignetteDuGabarit } from "@/fonctionnalites/gabarits/requetes";
import { peutGererGabarits } from "@/fonctionnalites/organisation/droits";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const id = (await params).id;
  const cle = peutGererGabarits(u) ? await vignetteAGerer(id) : await vignetteDuGabarit(id, u);
  const contenu = cle ? await stockage().lire(cle) : null;
  return contenu ? fichier(contenu, "image/jpeg") : erreur(404, "Pas de vignette.");
}
