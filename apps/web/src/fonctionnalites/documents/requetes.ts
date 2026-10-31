import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { estBureau, peutLireDocument, type Acteur, type StatutDocument, type Visibilite } from "@/fonctionnalites/organisation/droits";
import type { EtatValidation, TypeAdministratif } from "@/fonctionnalites/administratif/types";

export type OrigineDocument = "genere" | "depose" | "redige";

export interface ResumeDocument {
  id: string;
  titre: string;
  origine: OrigineDocument;
  statut: StatutDocument;
  /** Document administratif rédigé : type, état du circuit, numéro une fois validé. */
  typeAdministratif: TypeAdministratif | null;
  etatValidation: EtatValidation | null;
  numero: string | null;
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
  origine?: OrigineDocument;
  statut?: StatutDocument;
  /** Documents administratifs dans ces états du circuit. */
  etats?: EtatValidation[];
  activiteId?: string;
  /** Seulement les documents rattachés à aucune activité. */
  sansActivite?: boolean;
  mandatId?: string;
  /** Recherche plein texte (titre, nom du fichier, texte d'un document officiel), tous mandats confondus. */
  texte?: string;
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
      typeAdministratif: d.typeAdministratif,
      etatValidation: d.etatValidation,
      numero: d.numero,
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
        f.etats?.length ? inArray(d.etatValidation, f.etats) : undefined,
        f.activiteId ? eq(d.activiteId, f.activiteId) : undefined,
        f.sansActivite ? isNull(d.activiteId) : undefined,
        f.mandatId ? eq(d.mandatId, f.mandatId) : undefined,
        f.texte?.trim()
          ? sql`to_tsvector('french', ${d.titre} || ' ' || coalesce(${d.nomFichier}, '') || ' ' || coalesce(${d.contenu}::text, '')) @@ websearch_to_tsquery('french', ${f.texte.trim().slice(0, 200)})`
          : undefined,
        f.delegationId ? eq(d.delegationId, f.delegationId) : undefined,
      ),
    )
    .orderBy(desc(d.createdAt))
    .limit(limite);
}

/** Documents administratifs qui attendent une validation (pour le président, ou le vice-président en intérim). */
export async function nombreAValider(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(schema.document).where(eq(schema.document.etatValidation, "soumis"));
  return r?.n ?? 0;
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
      activite: schema.activite.titre,
      mandat: schema.mandat.libelle,
      fige: sql<boolean>`coalesce(${schema.mandat.statut} = 'clos', false)`,
    })
    .from(schema.document)
    .leftJoin(schema.revisionGabarit, eq(schema.document.revisionId, schema.revisionGabarit.id))
    .leftJoin(schema.gabarit, eq(schema.revisionGabarit.gabaritId, schema.gabarit.id))
    .innerJoin(schema.user, eq(schema.document.auteurId, schema.user.id))
    .leftJoin(schema.delegation, eq(schema.document.delegationId, schema.delegation.id))
    .leftJoin(schema.activite, eq(schema.document.activiteId, schema.activite.id))
    .leftJoin(schema.mandat, eq(schema.document.mandatId, schema.mandat.id))
    .where(eq(schema.document.id, id));
  if (!l) return null;
  // Rattachement et lecture seule réunis : `peutModifierDocument(u, l.d)` tient compte du mandat clos.
  const d = { ...l.d, fige: l.fige };
  if (!peutLireDocument(u, d)) return null;
  return { ...l, d };
}

export type DocumentLisible = NonNullable<Awaited<ReturnType<typeof documentLisible>>>;
