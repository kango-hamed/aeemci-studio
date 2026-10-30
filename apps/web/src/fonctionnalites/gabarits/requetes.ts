import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Gabarit } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";

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
}

/** Gabarits actifs, avec leur révision courante, du plus récemment publié au plus ancien. */
export async function gabaritsDisponibles(): Promise<GabaritDisponible[]> {
  const lignes = await db
    .select({ g: schema.gabarit, r: schema.revisionGabarit })
    .from(schema.gabarit)
    .innerJoin(schema.revisionGabarit, eq(schema.gabarit.revisionCouranteId, schema.revisionGabarit.id))
    .where(eq(schema.gabarit.actif, true))
    .orderBy(desc(schema.revisionGabarit.createdAt), asc(schema.gabarit.nom));
  return lignes.map(({ g, r }) => ({
    id: g.id,
    nom: g.nom,
    description: g.description,
    revisionId: r.id,
    numero: r.numero,
    aVignette: Boolean(r.vignette),
    largeur: r.contenu.plans[0]?.largeur_px ?? 0,
    hauteur: r.contenu.plans[0]?.hauteur_px ?? 0,
    nbPlans: r.contenu.plans.length,
  }));
}

export interface GabaritACompleter {
  id: string;
  nom: string;
  description: string | null;
  revision: { id: string; numero: number; prefixe: string; contenu: Gabarit };
}

/** Gabarit actif et sa révision courante, pour le formulaire de création. */
export async function gabaritACompleter(id: string): Promise<GabaritACompleter | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [l] = await db
    .select({ g: schema.gabarit, r: schema.revisionGabarit })
    .from(schema.gabarit)
    .innerJoin(schema.revisionGabarit, eq(schema.gabarit.revisionCouranteId, schema.revisionGabarit.id))
    .where(and(eq(schema.gabarit.id, id), eq(schema.gabarit.actif, true)));
  if (!l) return null;
  return { id: l.g.id, nom: l.g.nom, description: l.g.description, revision: { id: l.r.id, numero: l.r.numero, prefixe: l.r.prefixe, contenu: l.r.contenu } };
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

/** Clé de la vignette de la révision courante d'un gabarit actif. */
export async function vignetteDuGabarit(id: string): Promise<string | null> {
  const g = await gabaritACompleter(id);
  if (!g) return null;
  const [r] = await db.select({ v: schema.revisionGabarit.vignette }).from(schema.revisionGabarit).where(eq(schema.revisionGabarit.id, g.revision.id));
  return r?.v ?? null;
}
