import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { simplifier } from "@/fonctionnalites/csv";
import { peutGererOrganigramme, peutVoirContacts, type Acteur, type RoleComite } from "@/fonctionnalites/organisation/droits";
import { numeroPropre } from "@/fonctionnalites/organisation/telephone";
import { activiteLisible } from "./requetes";
import { regrouperParCommission, roleEquipeEcrit, type LigneOrganigramme, type RoleEquipe } from "./organigramme-csv";

/**
 * Organigramme d'une activité (lot 10b) : sous le PCO et son adjoint, des commissions propres à l'activité
 * (importées par le PCO) et des équipes du mandat reprises d'une activité à l'autre (« Communication »…).
 * Leurs membres sont de simples fiches, sans compte ; leurs numéros ne sont montrés qu'au comité.
 */

export interface PersonneEquipe {
  id: string;
  role: RoleEquipe;
  nom: string;
  /** `null` : pas de numéro, ou le lecteur n'est pas du comité. */
  telephone: string | null;
}

export interface EquipeOrganigramme {
  id: string;
  nom: string;
  /** Équipe du mandat, partagée avec d'autres activités. */
  partagee: boolean;
  membres: PersonneEquipe[];
}

export interface Organigramme {
  pco: string | null;
  adjoint: string | null;
  equipes: EquipeOrganigramme[];
  /** Le lecteur voit les numéros (il est du comité). */
  contacts: boolean;
}

const ORDRE_ROLE = sql`case ${schema.membreEquipe.role} when 'responsable' then 0 when 'adjoint' then 1 else 2 end`;

async function membresDes(ids: string[], contacts: boolean): Promise<Map<string, PersonneEquipe[]>> {
  const parEquipe = new Map<string, PersonneEquipe[]>(ids.map((id) => [id, []]));
  if (!ids.length) return parEquipe;
  const me = schema.membreEquipe;
  const lignes = await db
    .select({ id: me.id, equipeId: me.equipeId, role: me.role, nom: me.nom, telephone: me.telephone })
    .from(me)
    .where(inArray(me.equipeId, ids))
    .orderBy(ORDRE_ROLE, asc(me.ordre), asc(me.nom));
  for (const l of lignes) parEquipe.get(l.equipeId)!.push({ id: l.id, role: l.role, nom: l.nom, telephone: contacts ? l.telephone : null });
  return parEquipe;
}

/** Organigramme d'une activité déjà lue par `activiteLisible`. */
export async function organigrammeDe(u: Acteur, a: { id: string; comite: RoleComite | null }): Promise<Organigramme> {
  const contacts = peutVoirContacts(u, a);
  const e = schema.equipe;
  const mc = schema.membreComite;
  const [propres, partagees, tete] = await Promise.all([
    db.select({ id: e.id, nom: e.nom }).from(e).where(eq(e.activiteId, a.id)).orderBy(asc(e.ordre), asc(e.nom)),
    db
      .select({ id: e.id, nom: e.nom })
      .from(schema.activiteEquipe)
      .innerJoin(e, eq(e.id, schema.activiteEquipe.equipeId))
      .where(eq(schema.activiteEquipe.activiteId, a.id))
      .orderBy(asc(schema.activiteEquipe.createdAt), asc(e.nom)),
    db
      .select({ role: mc.role, nom: schema.user.name })
      .from(mc)
      .innerJoin(schema.user, eq(schema.user.id, mc.userId))
      .where(and(eq(mc.activiteId, a.id), inArray(mc.role, ["pco", "adjoint"]))),
  ]);
  const membres = await membresDes([...propres, ...partagees].map((x) => x.id), contacts);
  return {
    pco: tete.find((t) => t.role === "pco")?.nom ?? null,
    adjoint: tete.find((t) => t.role === "adjoint")?.nom ?? null,
    equipes: [...propres.map((x) => ({ ...x, partagee: false })), ...partagees.map((x) => ({ ...x, partagee: true }))].map((x) => ({ ...x, membres: membres.get(x.id)! })),
    contacts,
  };
}

// ── Contrôles ────────────────────────────────────────────────────────────────

async function activiteGerable(u: Acteur, activiteId: string) {
  const l = await activiteLisible(activiteId, u);
  if (!l) throw new ErreurSaisie("Activité introuvable.");
  if (l.a.fige) throw new ErreurSaisie("Cette activité appartient à un mandat clos : elle est en lecture seule.");
  if (!peutGererOrganigramme(u, l.a)) throw new ErreurSaisie("Seuls le PCO et son adjoint gèrent l'organigramme de l'activité.");
  return l;
}

/** Le membre est PCO (ou adjoint) d'au moins une activité du mandat : il gère les équipes du mandat. */
export async function estPcoDuMandat(u: Acteur, mandatId: string): Promise<boolean> {
  const [r] = await db
    .select({ un: sql<number>`1` })
    .from(schema.membreComite)
    .innerJoin(schema.activite, eq(schema.activite.id, schema.membreComite.activiteId))
    .innerJoin(schema.mandat, eq(schema.mandat.id, schema.activite.mandatId))
    .where(
      and(
        eq(schema.membreComite.userId, u.id),
        inArray(schema.membreComite.role, ["pco", "adjoint"]),
        eq(schema.activite.mandatId, mandatId),
        eq(schema.mandat.statut, "en_cours"),
      ),
    )
    .limit(1);
  return Boolean(r);
}

/** Équipe modifiable : une commission de l'activité gérée par le membre, ou une équipe du mandat s'il en est PCO. */
async function equipeGerable(u: Acteur, equipeId: string) {
  const [eq_] = await db
    .select({ id: schema.equipe.id, mandatId: schema.equipe.mandatId, activiteId: schema.equipe.activiteId, nom: schema.equipe.nom })
    .from(schema.equipe)
    .where(eq(schema.equipe.id, equipeId));
  if (!eq_) throw new ErreurSaisie("Commission introuvable.");
  if (eq_.activiteId) await activiteGerable(u, eq_.activiteId);
  else if (!(await estPcoDuMandat(u, eq_.mandatId))) throw new ErreurSaisie("Seuls les PCO du mandat gèrent ses équipes.");
  return eq_;
}

function verifierLignes(lignes: LigneOrganigramme[]) {
  const fautives = lignes.filter((l) => l.erreurs.length);
  if (fautives.length)
    throw new ErreurSaisie(
      `Rien n'a été importé : corrige le fichier. ${fautives
        .slice(0, 5)
        .map((l) => `Ligne ${l.ligne} : ${l.erreurs.join(" ")}`)
        .join(" ")}${fautives.length > 5 ? ` (et ${fautives.length - 5} autres lignes)` : ""}`,
    );
  return regrouperParCommission(lignes);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function remplirEquipe(tx: Tx, equipeId: string, membres: { role: RoleEquipe; nom: string; telephone: string | null }[]) {
  await tx.delete(schema.membreEquipe).where(eq(schema.membreEquipe.equipeId, equipeId));
  if (membres.length) await tx.insert(schema.membreEquipe).values(membres.map((m, ordre) => ({ ...m, equipeId, ordre })));
}

// ── Commissions de l'activité ────────────────────────────────────────────────

/** Importe les commissions de l'activité : elles remplacent les précédentes (les équipes du mandat restent). */
export async function importerCommissions(u: Acteur, activiteId: string, lignes: LigneOrganigramme[]): Promise<{ commissions: number; personnes: number }> {
  const l = await activiteGerable(u, activiteId);
  const groupes = verifierLignes(lignes);
  await db.transaction(async (tx) => {
    await tx.delete(schema.equipe).where(eq(schema.equipe.activiteId, activiteId));
    for (const [ordre, g] of groupes.entries()) {
      const [cree] = await tx.insert(schema.equipe).values({ mandatId: l.a.mandatId, activiteId, nom: g.nom, ordre, creePar: u.id }).returning({ id: schema.equipe.id });
      await remplirEquipe(tx, cree!.id, g.membres);
    }
  });
  return { commissions: groupes.length, personnes: lignes.length };
}

/** Crée une commission vide dans l'activité. */
export async function creerCommission(u: Acteur, activiteId: string, nom: string): Promise<void> {
  const l = await activiteGerable(u, activiteId);
  const propre = nom.trim().replace(/\s+/g, " ").slice(0, 80);
  if (propre.length < 2) throw new ErreurSaisie("Donne un nom à la commission.");
  const existantes = await db.select({ nom: schema.equipe.nom, ordre: schema.equipe.ordre }).from(schema.equipe).where(eq(schema.equipe.activiteId, activiteId));
  if (existantes.some((x) => simplifier(x.nom) === simplifier(propre))) throw new ErreurSaisie(`La commission « ${propre} » existe déjà.`);
  await db.insert(schema.equipe).values({ mandatId: l.a.mandatId, activiteId, nom: propre, ordre: Math.max(-1, ...existantes.map((x) => x.ordre)) + 1, creePar: u.id });
}

/** Retire de l'organigramme une commission (supprimée) ou une équipe du mandat (seulement détachée). */
export async function retirerEquipe(u: Acteur, activiteId: string, equipeId: string): Promise<void> {
  await activiteGerable(u, activiteId);
  const supprimees = await db
    .delete(schema.equipe)
    .where(and(eq(schema.equipe.id, equipeId), eq(schema.equipe.activiteId, activiteId)))
    .returning({ id: schema.equipe.id });
  if (!supprimees.length)
    await db.delete(schema.activiteEquipe).where(and(eq(schema.activiteEquipe.activiteId, activiteId), eq(schema.activiteEquipe.equipeId, equipeId)));
}

/** Reprend une équipe du mandat dans l'organigramme de l'activité. */
export async function reprendreEquipe(u: Acteur, activiteId: string, equipeId: string): Promise<void> {
  const l = await activiteGerable(u, activiteId);
  const [e] = await db
    .select({ id: schema.equipe.id })
    .from(schema.equipe)
    .where(and(eq(schema.equipe.id, equipeId), eq(schema.equipe.mandatId, l.a.mandatId), isNull(schema.equipe.activiteId)));
  if (!e) throw new ErreurSaisie("Équipe introuvable dans le mandat de l'activité.");
  await db.insert(schema.activiteEquipe).values({ activiteId, equipeId }).onConflictDoNothing();
}

// ── Personnes ────────────────────────────────────────────────────────────────

/** Ajoute une personne à une commission ou à une équipe ; un nouveau responsable (ou adjoint) remplace l'ancien, qui devient membre. */
export async function ajouterPersonne(u: Acteur, equipeId: string, s: { nom: string; role: string; telephone: string }): Promise<void> {
  await equipeGerable(u, equipeId);
  const nom = s.nom.trim().replace(/\s+/g, " ").slice(0, 100);
  if (nom.length < 2) throw new ErreurSaisie("Indique le nom de la personne.");
  const role = roleEquipeEcrit(s.role) ?? "membre";
  const telephone = s.telephone.trim() ? numeroPropre(s.telephone) : "";
  if (telephone === null) throw new ErreurSaisie("Numéro invalide : dix chiffres, ou l'indicatif précédé de +.");
  const me = schema.membreEquipe;
  await db.transaction(async (tx) => {
    if (role !== "membre") await tx.update(me).set({ role: "membre" }).where(and(eq(me.equipeId, equipeId), eq(me.role, role)));
    const [dernier] = await tx.select({ max: sql<number>`coalesce(max(${me.ordre}), -1)::int` }).from(me).where(eq(me.equipeId, equipeId));
    await tx.insert(me).values({ equipeId, role, nom, telephone: telephone || null, ordre: (dernier?.max ?? -1) + 1 });
  });
}

export async function retirerPersonne(u: Acteur, personneId: string): Promise<void> {
  const [p] = await db.select({ equipeId: schema.membreEquipe.equipeId }).from(schema.membreEquipe).where(eq(schema.membreEquipe.id, personneId));
  if (!p) return;
  await equipeGerable(u, p.equipeId);
  await db.delete(schema.membreEquipe).where(eq(schema.membreEquipe.id, personneId));
}

// ── Équipes du mandat ────────────────────────────────────────────────────────

export interface EquipeDuMandat extends EquipeOrganigramme {
  /** Activités qui l'ont reprise. */
  activites: { id: string; titre: string }[];
}

/** Équipes du mandat avec leurs membres et numéros : pour ses PCO seulement (sinon une liste vide). */
export async function equipesDuMandat(u: Acteur, mandatId: string): Promise<EquipeDuMandat[]> {
  if (!(await estPcoDuMandat(u, mandatId))) return [];
  const e = schema.equipe;
  const equipes = await db
    .select({ id: e.id, nom: e.nom })
    .from(e)
    .where(and(eq(e.mandatId, mandatId), isNull(e.activiteId)))
    .orderBy(asc(e.nom));
  const ids = equipes.map((x) => x.id);
  const [membres, liens] = await Promise.all([
    membresDes(ids, true),
    ids.length
      ? db
          .select({ equipeId: schema.activiteEquipe.equipeId, id: schema.activite.id, titre: schema.activite.titre })
          .from(schema.activiteEquipe)
          .innerJoin(schema.activite, eq(schema.activite.id, schema.activiteEquipe.activiteId))
          .where(inArray(schema.activiteEquipe.equipeId, ids))
          .orderBy(asc(schema.activite.date))
      : [],
  ]);
  return equipes.map((x) => ({ ...x, partagee: true, membres: membres.get(x.id)!, activites: liens.filter((l) => l.equipeId === x.id).map(({ id, titre }) => ({ id, titre })) }));
}

/** Noms des équipes du mandat, pour les reprendre dans une activité. */
export async function nomsEquipesDuMandat(mandatId: string): Promise<{ id: string; nom: string }[]> {
  return db
    .select({ id: schema.equipe.id, nom: schema.equipe.nom })
    .from(schema.equipe)
    .where(and(eq(schema.equipe.mandatId, mandatId), isNull(schema.equipe.activiteId)))
    .orderBy(asc(schema.equipe.nom));
}

/** Importe des équipes du mandat : celles du fichier sont créées, ou leurs membres remplacés ; les autres ne bougent pas. */
export async function importerEquipesDuMandat(u: Acteur, mandatId: string, lignes: LigneOrganigramme[]): Promise<{ commissions: number; personnes: number }> {
  if (!(await estPcoDuMandat(u, mandatId))) throw new ErreurSaisie("Seuls les PCO du mandat gèrent ses équipes.");
  const groupes = verifierLignes(lignes);
  const existantes = await nomsEquipesDuMandat(mandatId);
  await db.transaction(async (tx) => {
    for (const g of groupes) {
      let id = existantes.find((x) => simplifier(x.nom) === simplifier(g.nom))?.id;
      if (!id) id = (await tx.insert(schema.equipe).values({ mandatId, nom: g.nom, creePar: u.id }).returning({ id: schema.equipe.id }))[0]!.id;
      await remplirEquipe(tx, id, g.membres);
    }
  });
  return { commissions: groupes.length, personnes: lignes.length };
}

/** Supprime une équipe du mandat : elle disparaît des organigrammes qui l'avaient reprise. */
export async function supprimerEquipeDuMandat(u: Acteur, equipeId: string): Promise<void> {
  const e = await equipeGerable(u, equipeId);
  if (e.activiteId) throw new ErreurSaisie("Cette commission appartient à une activité : retire-la depuis sa fiche.");
  await db.delete(schema.equipe).where(eq(schema.equipe.id, equipeId));
}
