import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { dossierPassation, pdfPassation } from "@/fonctionnalites/mandats/passation";

/** Dossier de passation en PDF : `?mandat=<id>&cle=<délégation ou « bureau »>`, selon les droits du demandeur. */
export async function GET(request: Request) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const url = new URL(request.url);
  const dossier = await dossierPassation(u, url.searchParams.get("mandat") ?? "", url.searchParams.get("cle") ?? "");
  if (!dossier) return erreur(404, "Dossier introuvable.");
  const nom = `Passation-${dossier.mandat}-${dossier.volet}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-");
  return fichier(await pdfPassation(dossier), "application/pdf", `${nom}.pdf`, url.searchParams.has("telecharger"));
}
