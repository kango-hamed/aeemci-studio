import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Inscrit une suppression définitive au journal, dans la transaction qui supprime. */
export async function journaliserSuppression(tx: Transaction, quoi: "document" | "gabarit", objetId: string, libelle: string, parId: string): Promise<void> {
  const [par] = await tx.select({ nom: schema.user.name }).from(schema.user).where(eq(schema.user.id, parId));
  await tx.insert(schema.journalSuppression).values({ quoi, objetId, libelle: libelle.slice(0, 300), parId, parNom: par?.nom ?? "Inconnu" });
}

/** Dernières suppressions, les plus récentes d'abord. */
export async function dernieresSuppressions(limite = 50) {
  return db.select().from(schema.journalSuppression).orderBy(desc(schema.journalSuppression.createdAt)).limit(limite);
}

/** Fichiers supprimés après la transaction : un échec laisse des fichiers orphelins, jamais une ligne sans fichier. */
export async function supprimerFichiers(dossier: string): Promise<void> {
  try {
    await stockage().supprimerDossier(dossier);
  } catch (e) {
    console.error(`Suppression des fichiers de ${dossier} incomplète :`, e);
  }
}
