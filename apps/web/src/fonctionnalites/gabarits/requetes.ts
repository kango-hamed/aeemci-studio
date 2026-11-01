import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Gabarit } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { peutUtiliserGabarit, type Acteur } from "@/fonctionnalites/organisation/droits";

export interface GabaritDisponible {
  id: string;
  nom: string;
  description: string | null;
  revisionId: string;
  numero: number;
  aVignette: boolean;
  largeur: number;
  hauteur: number;
  nbPlans: number;
  /** Le formulaire demande une photo : proposé pour une photo partagée depuis la galerie. */
  aPhoto: boolean;
}

/** Délégations auxquelles chaque gabarit est réservé (absent : toute la section). */
async function reservations(): Promise<Map<string, string[]>> {
  const lignes = await db.select().from(schema.gabaritDelegation);
  const m = new Map<string, string[]>();
  for (const l of lignes) m.set(l.gabaritId, [...(m.get(l.gabaritId) ?? []), l.delegationId]);
  return m;
}

async function reservationsDe(gabaritId: string): Promise<string[]> {
  const lignes = await db.select({ d: schema.gabaritDelegation.delegationId }).from(schema.gabaritDelegation).where(eq(schema.gabaritDelegation.gabaritId, gabaritId));
  return lignes.map((l) => l.d);
}

/** Gabarits actifs que le membre peut utiliser, avec leur révision publiée, du plus récent au plus ancien. */
export async function gabaritsDisponibles(u: Acteur): Promise<GabaritDisponible[]> {
  const [lignes, reserves] = await Promise.all([
    db
      .select({ g: schema.gabarit, r: schema.revisionGabarit })
      .from(schema.gabarit)
      .innerJoin(schema.revisionGabarit, eq(schema.gabarit.revisionCouranteId, schema.revisionGabarit.id))
      .where(eq(schema.gabarit.actif, true))
      .orderBy(desc(schema.revisionGabarit.publieeLe), asc(schema.gabarit.nom)),
    reservations(),
  ]);
  return lignes
    .filter(({ g }) => peutUtiliserGabarit(u, reserves.get(g.id) ?? []))
    .map(({ g, r }) => ({
      id: g.id,
      nom: g.nom,
      description: g.description,
      revisionId: r.id,
      numero: r.numero ?? 0,
      aVignette: Boolean(r.vignette),
      largeur: r.contenu.plans[0]?.largeur_px ?? 0,
      hauteur: r.contenu.plans[0]?.hauteur_px ?? 0,
      nbPlans: r.contenu.plans.length,
      aPhoto: r.contenu.champs.some((c) => c.type === "image"),
    }));
}

export interface GabaritACompleter {
  id: string;
  nom: string;
  description: string | null;
  revision: { id: string; numero: number; prefixe: string; contenu: Gabarit };
}

/**
 * Gabarit actif et sa révision publiée, pour le formulaire de création. Avec `u` : `null` aussi si le
 * gabarit est réservé à d'autres délégations.
 */
export async function gabaritACompleter(id: string, u?: Acteur): Promise<GabaritACompleter | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [l] = await db
    .select({ g: schema.gabarit, r: schema.revisionGabarit })
    .from(schema.gabarit)
    .innerJoin(schema.revisionGabarit, eq(schema.gabarit.revisionCouranteId, schema.revisionGabarit.id))
    .where(and(eq(schema.gabarit.id, id), eq(schema.gabarit.actif, true)));
  if (!l) return null;
  if (u && !peutUtiliserGabarit(u, await reservationsDe(id))) return null;
  return { id: l.g.id, nom: l.g.nom, description: l.g.description, revision: { id: l.r.id, numero: l.r.numero ?? 0, prefixe: l.r.prefixe, contenu: l.r.contenu } };
}

/** Révision quelconque (même ancienne) : un document se refait toujours avec la sienne. */
export async function revisionParId(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [l] = await db
    .select({ r: schema.revisionGabarit, nom: schema.gabarit.nom, actif: schema.gabarit.actif, courante: schema.gabarit.revisionCouranteId })
    .from(schema.revisionGabarit)
    .innerJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .where(eq(schema.revisionGabarit.id, id));
  return l ?? null;
}

/** Clé de la vignette de la révision publiée d'un gabarit actif. */
export async function vignetteDuGabarit(id: string, u?: Acteur): Promise<string | null> {
  const g = await gabaritACompleter(id, u);
  if (!g) return null;
  const [r] = await db.select({ v: schema.revisionGabarit.vignette }).from(schema.revisionGabarit).where(eq(schema.revisionGabarit.id, g.revision.id));
  return r?.v ?? null;
}

/** Vignette de la révision en service, même si le gabarit n'est pas proposé aux membres (écrans de gestion). */
export async function vignetteAGerer(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [l] = await db
    .select({ v: schema.revisionGabarit.vignette })
    .from(schema.gabarit)
    .innerJoin(schema.revisionGabarit, eq(schema.gabarit.revisionCouranteId, schema.revisionGabarit.id))
    .where(eq(schema.gabarit.id, id));
  return l?.v ?? null;
}

// ── Gestion (administrateurs et designers) ─────────────────────────────────────

export interface GabaritAGerer {
  id: string;
  nom: string;
  actif: boolean;
  /** Révision publiée ; absente tant que le premier brouillon n'est pas publié. */
  numero: number | null;
  publieeLe: Date | null;
  aVignette: boolean;
  brouillon: boolean;
  reserve: number;
  documents: number;
}

/** Tous les gabarits, brouillons et désactivés compris. */
export async function gabaritsAGerer(): Promise<GabaritAGerer[]> {
  const g = schema.gabarit;
  const r = schema.revisionGabarit;
  const lignes = await db
    .select({
      id: g.id,
      nom: g.nom,
      actif: g.actif,
      numero: r.numero,
      publieeLe: r.publieeLe,
      vignette: r.vignette,
      brouillon: sql<boolean>`exists (select 1 from "revision_gabarit" b where b."gabarit_id" = "gabarit"."id" and b."publiee_le" is null)`,
      reserve: sql<number>`(select count(*) from "gabarit_delegation" gd where gd."gabarit_id" = "gabarit"."id")::int`,
      documents: sql<number>`(select count(*) from "document" d join "revision_gabarit" rd on rd."id" = d."revision_id" where rd."gabarit_id" = "gabarit"."id")::int`,
    })
    .from(g)
    .leftJoin(r, eq(g.revisionCouranteId, r.id))
    .orderBy(desc(g.actif), asc(g.nom));
  return lignes.map(({ vignette, ...l }) => ({ ...l, aVignette: Boolean(vignette) }));
}

export interface RevisionPubliee {
  id: string;
  numero: number;
  publieeLe: Date;
  par: string | null;
  documents: number;
}

export interface FicheGabarit {
  id: string;
  nom: string;
  description: string | null;
  actif: boolean;
  revisionCouranteId: string | null;
  delegations: string[];
  brouillon: { id: string; prefixe: string; contenu: Gabarit; importeLe: Date } | null;
  revisions: RevisionPubliee[];
}

export async function ficheGabarit(id: string): Promise<FicheGabarit | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [g] = await db.select().from(schema.gabarit).where(eq(schema.gabarit.id, id));
  if (!g) return null;
  const r = schema.revisionGabarit;
  const [brouillons, revisions, delegations] = await Promise.all([
    db.select().from(r).where(and(eq(r.gabaritId, id), isNull(r.publieeLe))).orderBy(desc(r.createdAt)).limit(1),
    db
      .select({
        id: r.id,
        numero: r.numero,
        publieeLe: r.publieeLe,
        par: schema.user.name,
        documents: sql<number>`(select count(*) from "document" d where d."revision_id" = "revision_gabarit"."id")::int`,
      })
      .from(r)
      .leftJoin(schema.user, eq(r.publieeParId, schema.user.id))
      .where(and(eq(r.gabaritId, id), isNotNull(r.publieeLe)))
      .orderBy(desc(r.numero)),
    reservationsDe(id),
  ]);
  const b = brouillons[0];
  return {
    id: g.id,
    nom: g.nom,
    description: g.description,
    actif: g.actif,
    revisionCouranteId: g.revisionCouranteId,
    delegations,
    brouillon: b ? { id: b.id, prefixe: b.prefixe, contenu: b.contenu, importeLe: b.createdAt } : null,
    revisions: revisions.map((x) => ({ ...x, numero: x.numero ?? 0, publieeLe: x.publieeLe! })),
  };
}
