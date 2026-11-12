import "server-only";
import { and, asc, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { estBureau, peutContribuerActivite, peutLireActivite, type Acteur, type RoleComite, type Visibilite } from "@/fonctionnalites/organisation/droits";

export interface ResumeActivite {
  id: string;
  titre: string;
  date: string;
  heure: string | null;
  lieu: string | null;
  visibilite: Visibilite;
  delegation: string | null;
  mandat: string;
  aUnBilan: boolean;
  documents: number;
  /** Nom du PCO, s'il est nommé. */
  pco: string | null;
  /** Place du membre dans le comité de cette activité. */
  monRole: RoleComite | null;
}

/** Place du membre dans le comité de l'activité (« activite » de la requête principale), en SQL. */
const roleDans = (userId: string) => sql<RoleComite | null>`(select mc.role from membre_comite mc where mc.activite_id = "activite"."id" and mc.user_id = ${userId})`;

/** `peutLireActivite` en SQL, pour les listes (même règle que `filtreLecture` des documents publiés). */
export function filtreLectureActivite(u: Acteur): SQL | undefined {
  if (u.estAdministrateur || estBureau(u)) return undefined;
  const a = schema.activite;
  const lisibles = [eq(a.visibilite, "section")];
  if (u.affectation?.delegationId) lisibles.push(and(eq(a.visibilite, "delegation"), eq(a.delegationId, u.affectation.delegationId))!);
  // Les membres du comité lisent l'activité quelle que soit sa visibilité.
  return or(eq(a.auteurId, u.id), ...lisibles, sql`exists (select 1 from membre_comite mc where mc.activite_id = ${a.id} and mc.user_id = ${u.id})`);
}

/** Jour courant à Abidjan (UTC), au format des dates d'activité. */
export function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface FiltresActivites {
  mandatId?: string;
  delegationId?: string;
  /** `avenir` : à partir d'aujourd'hui ; `passees` : avant. */
  quand?: "avenir" | "passees";
  /** Recherche plein texte (titre, lieu, description, bilan). */
  texte?: string;
  /** Seulement les activités dont le membre fait partie du comité. */
  mesComites?: boolean;
}

export async function rechercherActivites(u: Acteur, f: FiltresActivites = {}, limite = 100): Promise<ResumeActivite[]> {
  const a = schema.activite;
  const texte = f.texte?.trim();
  return db
    .select({
      id: a.id,
      titre: a.titre,
      date: a.date,
      heure: a.heure,
      lieu: a.lieu,
      visibilite: a.visibilite,
      delegation: schema.delegation.nom,
      mandat: schema.mandat.libelle,
      aUnBilan: sql<boolean>`${a.bilan} is not null`,
      // Sous-requête écrite en clair : Drizzle n'y qualifie pas les colonnes (« id » serait ambigu).
      documents: sql<number>`(select count(*)::int from document d where d.activite_id = "activite"."id")`,
      pco: sql<string | null>`(select u.name from membre_comite mc join "user" u on u.id = mc.user_id where mc.activite_id = "activite"."id" and mc.role = 'pco')`,
      monRole: roleDans(u.id),
    })
    .from(a)
    .innerJoin(schema.mandat, eq(a.mandatId, schema.mandat.id))
    .leftJoin(schema.delegation, eq(a.delegationId, schema.delegation.id))
    .where(
      and(
        filtreLectureActivite(u),
        f.mandatId ? eq(a.mandatId, f.mandatId) : undefined,
        f.delegationId ? eq(a.delegationId, f.delegationId) : undefined,
        f.mesComites ? sql`exists (select 1 from membre_comite mc where mc.activite_id = ${a.id} and mc.user_id = ${u.id})` : undefined,
        f.quand === "avenir" ? gte(a.date, aujourdhui()) : f.quand === "passees" ? lt(a.date, aujourdhui()) : undefined,
        texte
          ? sql`to_tsvector('french', ${a.titre} || ' ' || coalesce(${a.lieu}, '') || ' ' || coalesce(${a.description}, '') || ' ' || coalesce(${a.bilan}, '')) @@ websearch_to_tsquery('french', ${texte.slice(0, 200)})`
          : undefined,
      ),
    )
    .orderBy(f.quand === "avenir" ? asc(a.date) : desc(a.date))
    .limit(limite);
}

/** Activité lisible par le membre, avec `fige` (mandat clos), ou `null`. */
export async function activiteLisible(id: string, u: Acteur) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [l] = await db
    .select({
      a: schema.activite,
      delegation: schema.delegation.nom,
      auteur: schema.user.name,
      mandat: schema.mandat.libelle,
      fige: sql<boolean>`${schema.mandat.statut} = 'clos'`,
      comite: roleDans(u.id),
    })
    .from(schema.activite)
    .innerJoin(schema.mandat, eq(schema.activite.mandatId, schema.mandat.id))
    .innerJoin(schema.user, eq(schema.activite.auteurId, schema.user.id))
    .leftJoin(schema.delegation, eq(schema.activite.delegationId, schema.delegation.id))
    .where(eq(schema.activite.id, id));
  if (!l) return null;
  const a = { ...l.a, fige: l.fige, comite: l.comite };
  if (!peutLireActivite(u, a)) return null;
  return { ...l, a };
}

export type ActiviteLisible = NonNullable<Awaited<ReturnType<typeof activiteLisible>>>;

/**
 * Activités du mandat en cours où le membre peut ajouter des photos (partage depuis la galerie) : les
 * prochaines d'abord, puis les plus récentes.
 */
export async function activitesPourPhotos(u: Acteur): Promise<{ id: string; titre: string; date: string }[]> {
  const a = schema.activite;
  const lignes = await db
    .select({ id: a.id, titre: a.titre, date: a.date, auteurId: a.auteurId, delegationId: a.delegationId, comite: roleDans(u.id) })
    .from(a)
    .innerJoin(schema.mandat, eq(a.mandatId, schema.mandat.id))
    .where(and(eq(schema.mandat.statut, "en_cours"), filtreLectureActivite(u)))
    .orderBy(desc(a.date))
    .limit(60);
  const jour = aujourdhui();
  const modifiables = lignes.filter((l) => peutContribuerActivite(u, l));
  // Aujourd'hui et les jours passés d'abord (les photos se prennent pendant ou après), puis celles à venir.
  return [...modifiables.filter((l) => l.date <= jour), ...modifiables.filter((l) => l.date > jour).reverse()].map(({ id, titre, date }) => ({ id, titre, date }));
}

export interface MembreDuComite {
  userId: string;
  nom: string;
  role: RoleComite;
  delegation: string | null;
  /** Rôle dans le mandat de l'activité (`null` : plus dans le mandat). */
  poste: string | null;
}

const ORDRE_COMITE: Record<RoleComite, number> = { pco: 0, adjoint: 1, membre: 2 };

/** Comité d'organisation d'une activité : PCO, adjoint, puis les membres par nom. */
export async function comiteDe(activiteId: string, mandatId: string): Promise<MembreDuComite[]> {
  const mc = schema.membreComite;
  const lignes = await db
    .select({ userId: mc.userId, nom: schema.user.name, role: mc.role, delegation: schema.delegation.nom, poste: schema.affectation.role })
    .from(mc)
    .innerJoin(schema.user, eq(schema.user.id, mc.userId))
    .leftJoin(schema.affectation, and(eq(schema.affectation.userId, mc.userId), eq(schema.affectation.mandatId, mandatId)))
    .leftJoin(schema.delegation, eq(schema.delegation.id, schema.affectation.delegationId))
    .where(eq(mc.activiteId, activiteId));
  return lignes.sort((x, y) => ORDRE_COMITE[x.role] - ORDRE_COMITE[y.role] || x.nom.localeCompare(y.nom, "fr"));
}

export interface CandidatComite {
  userId: string;
  nom: string;
  /** Délégation (`null` : bureau exécutif). */
  delegation: string | null;
}

/** Membres du mandat de l'activité qu'on peut mettre dans son comité, par délégation puis par nom. */
export async function candidatsComite(mandatId: string): Promise<CandidatComite[]> {
  return db
    .select({ userId: schema.user.id, nom: schema.user.name, delegation: schema.delegation.nom })
    .from(schema.affectation)
    .innerJoin(schema.user, eq(schema.user.id, schema.affectation.userId))
    .leftJoin(schema.delegation, eq(schema.delegation.id, schema.affectation.delegationId))
    .where(eq(schema.affectation.mandatId, mandatId))
    .orderBy(sql`${schema.delegation.nom} nulls first`, asc(schema.user.name));
}
