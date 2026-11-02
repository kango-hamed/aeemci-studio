import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";
import { creerZip } from "@/serveur/zip";
import { documentLisible } from "@/fonctionnalites/documents/requetes";
import { MAX_LIGNES_LOT } from "@/fonctionnalites/generation/lot";

const base = (titre: string) => titre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";

/**
 * Archive ZIP des documents générés d'un lot (`?ids=<id>,<id>…`), toutes déclinaisons comprises,
 * à la taille des réseaux sociaux. Un document illisible pour le membre est passé.
 */
export async function GET(request: Request) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean))];
  if (!ids.length || ids.length > MAX_LIGNES_LOT) return erreur(400, `De 1 à ${MAX_LIGNES_LOT} documents par archive.`);
  const fichiers: { nom: string; contenu: Buffer }[] = [];
  const largeur = String(ids.length).length;
  for (const [i, id] of ids.entries()) {
    const l = await documentLisible(id, u);
    if (!l || l.d.origine !== "genere") continue;
    const prefixe = `${String(i + 1).padStart(Math.max(2, largeur), "0")}-${base(l.d.titre)}`;
    for (const f of [{ plan: null, cle: l.d.fichier }, ...l.d.declinaisons.map((x) => ({ plan: x.plan, cle: x.fichier }))]) {
      const contenu = await stockage().lire(f.cle);
      if (contenu) fichiers.push({ nom: `${prefixe}${f.plan ? `-${base(f.plan)}` : ""}.png`, contenu });
    }
  }
  if (!fichiers.length) return erreur(404, "Aucun document à télécharger.");
  return fichier(creerZip(fichiers), "application/zip", "documents.zip", true);
}
