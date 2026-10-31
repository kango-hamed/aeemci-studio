import "server-only";
import { and, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { estBureau, peutLireDocument, type Acteur, type StatutDocument, type Visibilite } from "@/fonctionnalites/organisation/droits";

export interface ResumeDocument {
  id: string;
  titre: string;
  origine: "genere" | "depose";
  statut: StatutDocument;
  visibilite: Visibilite;
  /** Gabarit d'un document généré. */
  gabarit: string | null;
  type: string;
  largeur: number | null;
  hauteur: number | null;
  aMiniature: boolean;
  createdAt: Date;
  auteur: string;
  /** Document du membre qui consulte la liste. */
  estAMoi: boolean;
  delegation: string | null;
}

/** `peutLireDocument` en SQL, pour les listes. */
export function filtreLecture(u: Acteur): SQL | undefined {
  if (u.estAdministrateur || estBureau(u)) return undefined;
  const d = schema.document;
  const publies = [eq(d.visibilite, "section")];
  if (u.affectation?.delegationId) publies.push(and(eq(d.visibilite, "delegation"), eq(d.delegationId, u.affectation.delegationId))!);
  return or(eq(d.auteurId, u.id), and(eq(d.statut, "publie"), or(...publies)));
}

export interface FiltresDocuments {
  /** Recherche dans le titre. */
  q?: string;
  /** `miens` : seulement les documents du membre ; `autres` : seulement ceux des autres. */
  portee?: "miens" | "autres";
  origine?: "genere" | "depose";
  statut?: StatutDocument;
  delegationId?: string;
}

const echapperLike = (t: string) => t.replace(/[\\%_]/g, (c) => "\\" + c);

/** Documents lisibles par le membre, filtrés, du plus récent au plus ancien. */
export async function rechercherDocuments(u: Acteur, f: FiltresDocuments = {}, limite = 60): Promise<ResumeDocument[]> {
  const d = schema.document;
  const q = f.q?.trim();
  return db
    .select({
      id: d.id,
      titre: d.titre,
      origine: d.origine,
      statut: d.statut,
      visibilite: d.visibilite,
      gabarit: schema.gabarit.nom,
      type: d.type,
      largeur: d.largeur,
      hauteur: d.hauteur,
      aMiniature: sql<boolean>`${d.miniature} is not null`,
      createdAt: d.createdAt,
      auteur: schema.user.name,
      estAMoi: sql<boolean>`${d.auteurId} = ${u.id}`,
      delegation: schema.delegation.nom,
    })
    .from(d)
    .innerJoin(schema.user, eq(d.auteurId, schema.user.id))
    .leftJoin(schema.revisionGabarit, eq(d.revisionId, schema.revisionGabarit.id))
    .leftJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .leftJoin(schema.delegation, eq(d.delegationId, schema.delegation.id))
    .where(
      and(
        filtreLecture(u),
        q ? ilike(d.titre, `%${echapperLike(q.slice(0, 100))}%`) : undefined,
        f.portee === "miens" ? eq(d.auteurId, u.id) : f.portee === "autres" ? ne(d.auteurId, u.id) : undefined,
        f.origine ? eq(d.origine, f.origine) : undefined,
        f.statut ? eq(d.statut, f.statut) : undefined,
        f.delegationId ? eq(d.delegationId, f.delegationId) : undefined,
      ),
    )
    .orderBy(desc(d.createdAt))
    .limit(limite);
}

/** Documents créés par le membre, du plus récent au plus ancien. */
export async function documentsDe(u: Acteur, limite = 50): Promise<ResumeDocument[]> {
  return rechercherDocuments(u, { portee: "miens" }, limite);
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
      delegation: schema.delegation.nom,
    })
    .from(schema.document)
    .leftJoin(schema.revisionGabarit, eq(schema.document.revisionId, schema.revisionGabarit.id))
    .leftJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .innerJoin(schema.user, eq(schema.document.auteurId, schema.user.id))
    .leftJoin(schema.delegation, eq(schema.document.delegationId, schema.delegation.id))
    .where(eq(schema.document.id, id));
  if (!l) return null;
  if (!peutLireDocument(u, l.d)) return null;
  return l;
}

export type DocumentLisible = NonNullable<Awaited<ReturnType<typeof documentLisible>>>;
