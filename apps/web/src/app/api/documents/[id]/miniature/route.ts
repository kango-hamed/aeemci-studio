import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";
import { documentLisible } from "@/fonctionnalites/documents/requetes";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const l = await documentLisible((await params).id, u);
  const contenu = l?.d.miniature ? await stockage().lire(l.d.miniature) : null;
  return contenu ? fichier(contenu, "image/jpeg") : erreur(404, "Miniature introuvable.");
}
