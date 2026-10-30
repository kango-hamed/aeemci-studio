import "server-only";
import { randomUUID } from "node:crypto";
import { ErreurRendu, validerValeurs, type ErreurChamp, type Gabarit } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";
import { rendre } from "@/fonctionnalites/generation/rendu";
import { preparerValeurs, titreParDefaut, type ValeursSaisies } from "@/fonctionnalites/generation/valeurs";
import { gabaritACompleter } from "@/fonctionnalites/gabarits/requetes";

/** Largeur du fichier enregistré : celle des réseaux sociaux. La haute définition se refait à la demande. */
export const LARGEUR_RESEAUX = 1080;
const LARGEUR_MINIATURE = 360;

export class ErreurSaisie extends Error {
  constructor(
    message: string,
    readonly erreurs: ErreurChamp[] = [],
  ) {
    super(message);
  }
}

export interface DemandeDocument {
  gabaritId: string;
  /** Révision vue dans le formulaire : si le gabarit a été republié entre-temps, on prévient le membre. */
  revisionId: string;
  plan?: string;
  valeurs: ValeursSaisies;
  titre?: string;
}

export async function creerDocument(d: DemandeDocument, userId: string): Promise<{ id: string }> {
  const g = await gabaritACompleter(d.gabaritId);
  if (!g) throw new ErreurSaisie("Ce gabarit n'est plus disponible.");
  if (g.revision.id !== d.revisionId)
    throw new ErreurSaisie("Le gabarit vient d'être mis à jour par la cellule communication. Recharge la page : tes saisies seront à reprendre dans la nouvelle version.");
  const gabarit: Gabarit = g.revision.contenu;
  const plan = d.plan ? gabarit.plans.find((p) => p.plan === d.plan) : gabarit.plans[0];
  if (!plan) throw new ErreurSaisie("Déclinaison inconnue.");

  const valeurs = await preparerValeurs(gabarit, d.valeurs, userId);
  const erreurs = validerValeurs(gabarit, valeurs.moteur);
  if (erreurs.length) throw new ErreurSaisie("Le formulaire est incomplet.", erreurs);

  const id = randomUUID();
  try {
    const principal = await rendre({ revision: g.revision, valeurs: valeurs.moteur, plan: plan.plan, format: "png", largeurMax: LARGEUR_RESEAUX });
    const miniature = await rendre({ revision: g.revision, valeurs: valeurs.moteur, plan: plan.plan, format: "jpeg", largeurMax: LARGEUR_MINIATURE });
    const cle = `documents/${id}/${plan.plan}.png`;
    await stockage().ecrire(cle, principal.fichier, principal.type);
    await stockage().ecrire(`documents/${id}/miniature.jpg`, miniature.fichier, "image/jpeg");
    await db.insert(schema.document).values({
      id,
      auteurId: userId,
      revisionId: g.revision.id,
      titre: (d.titre?.trim() || titreParDefaut(g.nom, gabarit, valeurs.stockees)).slice(0, 200),
      plan: plan.plan,
      valeurs: valeurs.stockees,
      fichier: cle,
      type: principal.type,
      largeur: principal.largeur,
      hauteur: principal.hauteur,
      miniature: `documents/${id}/miniature.jpg`,
    });
  } catch (e) {
    if (e instanceof ErreurRendu) throw new ErreurSaisie(e.message, e.erreurs);
    throw e;
  }
  return { id };
}

/** Version haute définition (JPEG, `LARGEUR_HD` px au plus), faite au premier téléchargement puis gardée. */
export async function fichierHauteDefinition(doc: typeof schema.document.$inferSelect, revision: { id: string; prefixe: string; contenu: Gabarit }): Promise<Buffer> {
  const cle = `documents/${doc.id}/${doc.plan}-hd.jpg`;
  const deja = await stockage().lire(cle);
  if (deja) return deja;
  const valeurs = await preparerValeurs(revision.contenu, doc.valeurs, doc.auteurId);
  const r = await rendre({ revision, valeurs: valeurs.moteur, plan: doc.plan, format: "jpeg", hd: true });
  await stockage().ecrire(cle, r.fichier, "image/jpeg");
  return r.fichier;
}
