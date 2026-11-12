import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { dossierComite, nomFichier, pdfComite, zipFichesCommissions } from "@/fonctionnalites/activites/organigramme-pdf";

/**
 * Comité d'organisation de l'activité, avec les contacts, pour les membres du comité : la liste entière en
 * PDF, la fiche d'une commission (`?equipe=<id>`), ou une fiche par commission dans un zip (`?fiches`).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const d = await dossierComite(u, (await params).id);
  if (!d) return erreur(404, "Liste introuvable.");
  const url = new URL(request.url);
  const telecharger = url.searchParams.has("telecharger");
  if (url.searchParams.has("fiches")) {
    const zip = await zipFichesCommissions(d);
    return zip ? fichier(zip, "application/zip", `Commissions-${nomFichier(d.titre)}.zip`, true) : erreur(404, "Aucune commission.");
  }
  const equipeId = url.searchParams.get("equipe") ?? undefined;
  const pdf = await pdfComite(d, equipeId);
  if (!pdf) return erreur(404, "Commission introuvable.");
  const nom = equipeId ? d.organigramme.equipes.find((q) => q.id === equipeId)!.nom : "Comite";
  return fichier(pdf, "application/pdf", `${nomFichier(`${nom}-${d.titre}`)}.pdf`, telecharger);
}
