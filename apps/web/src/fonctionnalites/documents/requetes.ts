import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import type { Utilisateur } from "@/fonctionnalites/authentification/session";

export interface ResumeDocument {
  id: string;
  titre: string;
  gabarit: string;
  largeur: number;
  hauteur: number;
  createdAt: Date;
}

/** Documents créés par le membre, du plus récent au plus ancien. */
export async function documentsDe(userId: string, limite = 50): Promise<ResumeDocument[]> {
  return db
    .select({
      id: schema.document.id,
      titre: schema.document.titre,
      gabarit: schema.gabarit.nom,
      largeur: schema.document.largeur,
      hauteur: schema.document.hauteur,
      createdAt: schema.document.createdAt,
    })
    .from(schema.document)
    .innerJoin(schema.revisionGabarit, eq(schema.document.revisionId, schema.revisionGabarit.id))
    .innerJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .where(eq(schema.document.auteurId, userId))
    .orderBy(desc(schema.document.createdAt))
    .limit(limite);
}

/**
 * Document lisible par le membre : le sien, ou n'importe lequel pour un administrateur.
 * (Le lot 2 ouvrira la lecture aux membres de la même délégation.)
 */
export async function documentLisible(id: string, u: Utilisateur) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [l] = await db
    .select({ d: schema.document, gabarit: schema.gabarit.nom, gabaritId: schema.gabarit.id, numero: schema.revisionGabarit.numero, revision: schema.revisionGabarit })
    .from(schema.document)
    .innerJoin(schema.revisionGabarit, eq(schema.document.revisionId, schema.revisionGabarit.id))
    .innerJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .where(eq(schema.document.id, id));
  if (!l) return null;
  if (l.d.auteurId !== u.id && !u.estAdministrateur) return null;
  return l;
}
