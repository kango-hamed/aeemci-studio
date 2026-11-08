import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { MOT_CONFIRMATION, peutSupprimerDefinitivement, refusSuppressionDocument, type Acteur } from "@/fonctionnalites/organisation/droits";
import { journaliserSuppression, supprimerFichiers } from "@/fonctionnalites/organisation/journal";
import { ErreurSaisie } from "./creer";
import { documentLisible } from "./requetes";

/**
 * Suppression définitive d'un document : administrateurs seulement, mot de confirmation recopié, jamais
 * un document officiel validé ni un document d'un mandat clos. Son historique de validation part avec
 * lui ; la suppression est inscrite au journal, puis ses fichiers sont effacés du stockage.
 */
export async function supprimerDocument(u: Acteur, id: string, confirmation: string): Promise<void> {
  if (!peutSupprimerDefinitivement(u)) throw new ErreurSaisie("Seul un administrateur supprime un document.");
  const l = await documentLisible(id, u);
  if (!l) throw new ErreurSaisie("Document introuvable.");
  const refus = refusSuppressionDocument(l.d);
  if (refus) throw new ErreurSaisie(refus);
  if (confirmation.trim().toUpperCase() !== MOT_CONFIRMATION) throw new ErreurSaisie(`Écris ${MOT_CONFIRMATION} pour confirmer.`);
  await db.transaction(async (tx) => {
    // Une version en cours de correction ne pointe plus vers ce document.
    await tx.update(schema.document).set({ versionDeId: null }).where(eq(schema.document.versionDeId, l.d.id));
    await tx.delete(schema.document).where(eq(schema.document.id, l.d.id));
    await journaliserSuppression(tx, "document", l.d.id, l.d.titre, u.id);
  });
  await supprimerFichiers(`documents/${l.d.id}`);
}
