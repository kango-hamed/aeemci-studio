import { revalidatePath } from "next/cache";
import { erreur, fichier, membreOuRefus } from "@/serveur/reponses";
import { stockage } from "@/serveur/stockage";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { reconnaitre } from "@/fonctionnalites/documents/deposer";
import { cachetDeSection, signatureDe } from "@/fonctionnalites/administratif/circuit";
import { enregistrerCachet, enregistrerSignature, TAILLE_MAX_IMAGE } from "@/fonctionnalites/administratif/signatures";
import { estBureau, peutGererCachet } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

/** `?quoi=cachet` : le cachet de la section (bureau exécutif) ; sinon la signature du membre connecté. */
export async function GET(request: Request) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  const cachet = new URL(request.url).searchParams.get("quoi") === "cachet";
  let cle: string | null;
  if (cachet) {
    if (!estBureau(u) && !u.estAdministrateur) return erreur(403, "Réservé au bureau exécutif.");
    const m = await mandatCourant();
    cle = m ? await cachetDeSection(m.sectionId) : null;
  } else {
    cle = await signatureDe(u.id);
  }
  const contenu = cle ? await stockage().lire(cle) : null;
  if (!contenu) return erreur(404, "Aucune image enregistrée.");
  return fichier(contenu, reconnaitre(contenu)?.type ?? "application/octet-stream");
}

/** Remplace la signature du membre (`quoi=signature`) ou le cachet de la section (`quoi=cachet`), en `multipart/form-data`. */
export async function POST(request: Request) {
  const u = await membreOuRefus();
  if (u instanceof Response) return u;
  if (Number(request.headers.get("content-length") ?? 0) > TAILLE_MAX_IMAGE + 64 * 1024) return erreur(413, "Image trop lourde (2 Mo au plus).");
  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!form || !image || typeof image === "string") return erreur(400, "Aucune image reçue.");
  const quoi = form.get("quoi");
  if (quoi === "cachet" && !peutGererCachet(u)) return erreur(403, "Seul le président enregistre le cachet de la section.");
  try {
    const contenu = Buffer.from(await image.arrayBuffer());
    if (quoi === "cachet") await enregistrerCachet(u, contenu);
    else await enregistrerSignature(u, contenu);
  } catch (e) {
    if (e instanceof ErreurSaisie) return erreur(422, e.message);
    throw e;
  }
  revalidatePath("/signature");
  return Response.json({ ok: true }, { status: 201 });
}
