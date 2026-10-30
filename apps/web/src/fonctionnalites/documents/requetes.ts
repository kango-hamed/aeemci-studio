import "server-only";
import { and, desc, eq, ne, type SQL } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { estBureau, peutLireDocument, type Acteur } from "@/fonctionnalites/organisation/droits";

export interface ResumeDocument {
  id: string;
  titre: string;
  gabarit: string;
  largeur: number;
  hauteur: number;
  createdAt: Date;
  /** Auteur, renseigné pour les documents des autres membres. */
  auteur?: string;
}

function resumes(filtre: SQL | undefined, limite: number, avecAuteur = false): Promise<ResumeDocument[]> {
  return db
    .select({
      id: schema.document.id,
      titre: schema.document.titre,
      gabarit: schema.gabarit.nom,
      largeur: schema.document.largeur,
      hauteur: schema.document.hauteur,
      createdAt: schema.document.createdAt,
      ...(avecAuteur ? { auteur: schema.user.name } : {}),
    })
    .from(schema.document)
    .innerJoin(schema.revisionGabarit, eq(schema.document.revisionId, schema.revisionGabarit.id))
    .innerJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .innerJoin(schema.user, eq(schema.document.auteurId, schema.user.id))
    .where(filtre)
    .orderBy(desc(schema.document.createdAt))
    .limit(limite);
}

/** Documents créés par le membre, du plus récent au plus ancien. */
export async function documentsDe(userId: string, limite = 50): Promise<ResumeDocument[]> {
  return resumes(eq(schema.document.auteurId, userId), limite);
}

/**
 * Documents des autres membres que le membre peut lire : ceux de sa délégation, ou tous pour le bureau
 * exécutif et les administrateurs. `null` : il n'en voit aucun (pas de délégation).
 */
export async function documentsPartages(u: Acteur, limite = 50): Promise<ResumeDocument[] | null> {
  const autres = ne(schema.document.auteurId, u.id);
  if (u.estAdministrateur || estBureau(u)) return resumes(autres, limite, true);
  const delegationId = u.affectation?.delegationId;
  if (!delegationId) return null;
  return resumes(and(autres, eq(schema.document.delegationId, delegationId)), limite, true);
}

/** Document lisible par le membre (voir `peutLireDocument`), ou `null`. */
export async function documentLisible(id: string, u: Acteur) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [l] = await db
    .select({
      d: schema.document,
      gabarit: schema.gabarit.nom,
      gabaritId: schema.gabarit.id,
      numero: schema.revisionGabarit.numero,
      revision: schema.revisionGabarit,
      auteur: schema.user.name,
    })
    .from(schema.document)
    .innerJoin(schema.revisionGabarit, eq(schema.document.revisionId, schema.revisionGabarit.id))
    .innerJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .innerJoin(schema.user, eq(schema.document.auteurId, schema.user.id))
    .where(eq(schema.document.id, id));
  if (!l) return null;
  if (!peutLireDocument(u, l.d)) return null;
  return l;
}
