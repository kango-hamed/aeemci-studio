import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";
import { documentLisible } from "@/fonctionnalites/documents/requetes";
import { fichierHauteDefinition } from "@/fonctionnalites/documents/creer";

function nomDeFichier(titre: string, ext: string) {
  const base = titre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";
  return `${base}.${ext}`;
}

/** `?qualite=hd` : taille d'impression (JPEG). `?telecharger=1` : propose l'enregistrement. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const l = await documentLisible((await params).id, u);
  if (!l) return erreur(404, "Document introuvable.");
  const url = new URL(request.url);
  const telecharger = url.searchParams.has("telecharger");
  if (url.searchParams.get("qualite") === "hd") {
    const contenu = await fichierHauteDefinition(l.d, { id: l.revision.id, prefixe: l.revision.prefixe, contenu: l.revision.contenu });
    return fichier(contenu, "image/jpeg", nomDeFichier(l.d.titre + "-HD", "jpg"), telecharger);
  }
  const contenu = await stockage().lire(l.d.fichier);
  if (!contenu) return erreur(404, "Fichier introuvable.");
  return fichier(contenu, l.d.type, nomDeFichier(l.d.titre, "png"), telecharger);
}
