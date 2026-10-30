import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import type { Role } from "./roles";

export interface AffectationCourante {
  role: Role;
  mandat: string;
  delegation: string | null;
  section: string;
}

/** Rôle du membre dans le mandat en cours de sa section, s'il en a un. */
export async function affectationCourante(userId: string): Promise<AffectationCourante | null> {
  const [ligne] = await db
    .select({
      role: schema.affectation.role,
      mandat: schema.mandat.libelle,
      delegation: schema.delegation.nom,
      section: schema.section.nom,
    })
    .from(schema.affectation)
    .innerJoin(schema.mandat, eq(schema.affectation.mandatId, schema.mandat.id))
    .innerJoin(schema.section, eq(schema.mandat.sectionId, schema.section.id))
    .leftJoin(schema.delegation, eq(schema.affectation.delegationId, schema.delegation.id))
    .where(and(eq(schema.affectation.userId, userId), eq(schema.mandat.statut, "en_cours")))
    .limit(1);
  return ligne ?? null;
}
