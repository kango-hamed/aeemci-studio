import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { estBureau, type Acteur } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

export interface MandatArchive {
  id: string;
  libelle: string;
  statut: "en_cours" | "clos";
  debut: Date | null;
  fin: Date | null;
  documents: number;
  activites: number;
}

/** Tous les mandats de la section, le plus récent d'abord, avec le nombre de documents et d'activités. */
export async function mandatsDeLaSection(sectionId: string): Promise<MandatArchive[]> {
  const m = schema.mandat;
  return db
    .select({
      id: m.id,
      libelle: m.libelle,
      statut: m.statut,
      debut: m.debut,
      fin: m.fin,
      // Sous-requêtes écrites en clair : Drizzle n'y qualifie pas les colonnes (« id » serait ambigu).
      documents: sql<number>`(select count(*)::int from document d where d.mandat_id = "mandat"."id")`,
      activites: sql<number>`(select count(*)::int from activite a where a.mandat_id = "mandat"."id")`,
    })
    .from(m)
    .where(eq(m.sectionId, sectionId))
    .orderBy(asc(m.statut), desc(m.libelle));
}

function exigerBureau(u: Acteur) {
  if (!(u.estAdministrateur || estBureau(u))) throw new ErreurSaisie("Réservé au bureau exécutif.");
}

/** Mandat passé créé pour y ranger d'anciens dossiers (avant la plateforme) ; directement clos. */
export async function creerMandatPasse(u: Acteur, libelle: string): Promise<string> {
  exigerBureau(u);
  const courant = await mandatCourant();
  if (!courant) throw new ErreurSaisie("Aucun mandat en cours.");
  const l = libelle.trim().replace(/\s+/g, " ");
  if (l.length < 4 || l.length > 40) throw new ErreurSaisie("Nomme le mandat, par exemple « 2023-2024 ».");
  const [existant] = await db
    .select({ id: schema.mandat.id })
    .from(schema.mandat)
    .where(and(eq(schema.mandat.sectionId, courant.sectionId), eq(schema.mandat.libelle, l)));
  if (existant) return existant.id;
  const [m] = await db.insert(schema.mandat).values({ sectionId: courant.sectionId, libelle: l, statut: "clos" }).returning({ id: schema.mandat.id });
  return m!.id;
}

/** Rattachement d'un fichier importé dans les archives : bureau seulement, mandat et délégation de la section. */
export async function mandatPourImport(u: Acteur, mandatId: string, delegationId: string | null): Promise<{ mandatId: string; delegationId: string | null }> {
  exigerBureau(u);
  const courant = await mandatCourant();
  const [m] = await db
    .select({ id: schema.mandat.id })
    .from(schema.mandat)
    .where(and(eq(schema.mandat.id, mandatId), eq(schema.mandat.sectionId, courant?.sectionId ?? "")));
  if (!m) throw new ErreurSaisie("Mandat inconnu.");
  if (delegationId) {
    const [d] = await db
      .select({ id: schema.delegation.id })
      .from(schema.delegation)
      .where(and(eq(schema.delegation.id, delegationId), eq(schema.delegation.sectionId, courant!.sectionId)));
    if (!d) throw new ErreurSaisie("Délégation inconnue.");
  }
  return { mandatId: m.id, delegationId };
}
