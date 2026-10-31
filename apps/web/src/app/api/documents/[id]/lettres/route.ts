import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";
import { creerZip } from "@/serveur/zip";
import { documentLisible } from "@/fonctionnalites/documents/requetes";
import { cleLettre } from "@/fonctionnalites/administratif/circuit";
import { suffixeLettre } from "@/fonctionnalites/administratif/envois";

const nettoyer = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Lettres en nombre validées : un PDF par destinataire, réunis dans un zip (« 01-Kone-Ibrahim.pdf »…). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const l = await documentLisible((await params).id, u);
  if (!l) return erreur(404, "Document introuvable.");
  const liste = l.d.destinataires;
  if (!liste || l.d.etatValidation !== "valide") return erreur(404, "Ce document n'a pas de lettres séparées.");

  const fichiers: { nom: string; contenu: Buffer }[] = [];
  for (const [i, d] of liste.entries()) {
    const suffixe = suffixeLettre(i + 1, liste.length);
    const contenu = await stockage().lire(cleLettre(l.d.id, suffixe));
    if (!contenu) return erreur(404, "Lettre introuvable.");
    fichiers.push({ nom: `${suffixe}-${nettoyer(d.nom ?? d.organisme ?? "") || "lettre"}.pdf`, contenu });
  }
  return fichier(creerZip(fichiers), "application/zip", `${nettoyer(l.d.numero ?? l.d.titre) || "lettres"}.zip`, true);
}
