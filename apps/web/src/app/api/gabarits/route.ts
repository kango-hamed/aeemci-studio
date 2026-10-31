import { erreur, membreOuRefus } from "@/serveur/reponses";
import { ErreurImport, importerGabarit, TAILLE_MAX_IMPORT } from "@/fonctionnalites/gabarits/importer";
import { peutGererGabarits } from "@/fonctionnalites/organisation/droits";

/**
 * Import du dossier d'un gabarit produit par le plugin Photoshop (administrateurs et designers).
 * Corps multipart : paires `chemin` (chemin relatif dans le dossier) / `fichier`, dans le même ordre ;
 * `gabaritId` facultatif : le dossier devient la nouvelle version de ce gabarit. Réponse : le brouillon créé.
 */
export async function POST(request: Request) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  if (!peutGererGabarits(u)) return erreur(403, "Réservé aux administrateurs et aux designers.");
  const taille = Number(request.headers.get("content-length") ?? 0);
  if (taille > TAILLE_MAX_IMPORT) return erreur(413, "Dossier trop lourd (30 Mo au plus).");

  const form = await request.formData();
  const chemins = form.getAll("chemin").map(String);
  const contenus = form.getAll("fichier");
  if (!chemins.length || chemins.length !== contenus.length) return erreur(400, "Envoi incomplet : aucun fichier reçu.");
  const fichiers = new Map<string, Buffer>();
  for (let i = 0; i < chemins.length; i++) {
    const f = contenus[i];
    if (typeof f === "string") return erreur(400, "Envoi invalide.");
    fichiers.set(chemins[i]!, Buffer.from(await f.arrayBuffer()));
  }
  const gabaritId = form.get("gabaritId");
  try {
    return Response.json(await importerGabarit(fichiers, u.id, { gabaritId: typeof gabaritId === "string" && gabaritId ? gabaritId : undefined }));
  } catch (e) {
    if (e instanceof ErreurImport) return erreur(422, e.message, { details: e.details });
    throw e;
  }
}
