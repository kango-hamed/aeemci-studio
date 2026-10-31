import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, eq, ne } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { peutGererOrganisation, peutToucherAuPresident, type Acteur } from "./droits";
import { nouveauLien } from "./invitations";
import { mandatCourant, type MandatCourant } from "./requetes";
import { estRoleBureau, type Role } from "./roles";

/**
 * Gestion de l'organisation par le bureau exécutif : comptes, rôles du mandat en cours, délégations.
 * Chaque opération vérifie elle-même les droits de l'acteur ; les actions serveur ne font que valider
 * la saisie et rafraîchir l'écran.
 */
export class ErreurOrganisation extends Error {}

async function contexte(acteur: Acteur): Promise<MandatCourant> {
  if (!peutGererOrganisation(acteur)) throw new ErreurOrganisation("Réservé au bureau exécutif.");
  const m = await mandatCourant();
  if (!m) throw new ErreurOrganisation("Aucun mandat en cours : crée-le d'abord (npm run admin:creer avec --role et --mandat).");
  return m;
}

/** Violation d'unicité Postgres, directe ou enveloppée par Drizzle. */
function estDoublon(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | null)?.code;
  return code(e) === "23505" || code((e as { cause?: unknown } | null)?.cause) === "23505";
}

export interface Poste {
  role: Role;
  /** Ignorée pour les rôles du bureau exécutif ; obligatoire pour les autres. */
  delegationId?: string | null;
}

/** Vérifie un poste dans le mandat et renvoie la délégation à enregistrer. */
async function verifierPoste(acteur: Acteur, m: MandatCourant, p: Poste, affectationIgnoree?: string): Promise<string | null> {
  if (p.role === "president") {
    if (!peutToucherAuPresident(acteur)) throw new ErreurOrganisation("Seul le président (ou un administrateur) peut confier le rôle de président.");
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.affectation)
      .where(
        and(
          eq(schema.affectation.mandatId, m.id),
          eq(schema.affectation.role, "president"),
          affectationIgnoree ? ne(schema.affectation.id, affectationIgnoree) : undefined,
        ),
      );
    if (n > 0) throw new ErreurOrganisation("Le mandat a déjà un président : change d'abord son rôle.");
  }
  if (estRoleBureau(p.role)) return null;
  if (!p.delegationId) throw new ErreurOrganisation("Choisis la délégation du membre.");
  const [d] = await db
    .select()
    .from(schema.delegation)
    .where(and(eq(schema.delegation.id, p.delegationId), eq(schema.delegation.sectionId, m.sectionId)));
  if (!d) throw new ErreurOrganisation("Délégation inconnue.");
  if (d.archivee) throw new ErreurOrganisation(`La délégation « ${d.nom} » est archivée.`);
  return d.id;
}

async function affectationDuMandat(m: MandatCourant, affectationId: string) {
  const [a] = await db
    .select()
    .from(schema.affectation)
    .where(and(eq(schema.affectation.id, affectationId), eq(schema.affectation.mandatId, m.id)));
  if (!a) throw new ErreurOrganisation("Ce membre n'est plus dans le mandat en cours.");
  return a;
}

/** Garde-fous communs à la modification et au retrait d'un rôle existant. */
function verifierCible(acteur: Acteur, a: { userId: string; role: Role }) {
  if (a.userId === acteur.id && !acteur.estAdministrateur)
    throw new ErreurOrganisation("Tu ne peux pas changer ton propre rôle : demande à un autre membre du bureau.");
  if (a.role === "president" && !peutToucherAuPresident(acteur))
    throw new ErreurOrganisation("Seul le président (ou un administrateur) peut changer le rôle du président.");
}

export interface NouveauMembre extends Poste {
  nom: string;
  email: string;
}

/**
 * Ajoute un membre au mandat en cours : crée son compte s'il n'existe pas, ou réaffecte un ancien membre.
 * `jeton` : lien d'activation à lui transmettre, si son compte n'a pas encore de mot de passe.
 */
export async function ajouterMembre(acteur: Acteur, n: NouveauMembre): Promise<{ userId: string; jeton: string | null }> {
  const m = await contexte(acteur);
  const delegationId = await verifierPoste(acteur, m, n);
  const email = n.email.trim().toLowerCase();
  const [existant] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  let userId: string;
  if (existant) {
    userId = existant.id;
    const [deja] = await db
      .select({ id: schema.affectation.id })
      .from(schema.affectation)
      .where(and(eq(schema.affectation.mandatId, m.id), eq(schema.affectation.userId, userId)));
    if (deja) throw new ErreurOrganisation(`${existant.name} est déjà dans le mandat ${m.libelle}.`);
    await db.insert(schema.affectation).values({ mandatId: m.id, userId, role: n.role, delegationId });
  } else {
    userId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(schema.user).values({ id: userId, name: n.nom.trim(), email });
      await tx.insert(schema.affectation).values({ mandatId: m.id, userId, role: n.role, delegationId });
    });
  }
  const [compte] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")));
  return { userId, jeton: compte ? null : await nouveauLien(userId, acteur.id) };
}

export async function modifierPoste(acteur: Acteur, affectationId: string, p: Poste): Promise<void> {
  const m = await contexte(acteur);
  const a = await affectationDuMandat(m, affectationId);
  verifierCible(acteur, a);
  const delegationId = await verifierPoste(acteur, m, p, a.id);
  await db.update(schema.affectation).set({ role: p.role, delegationId }).where(eq(schema.affectation.id, a.id));
}

/** Marque (ou non) le membre comme designer : il gère alors les gabarits, quel que soit son rôle. */
export async function changerDesigner(acteur: Acteur, affectationId: string, designer: boolean): Promise<void> {
  const m = await contexte(acteur);
  const a = await affectationDuMandat(m, affectationId);
  await db.update(schema.affectation).set({ designer }).where(eq(schema.affectation.id, a.id));
}

/** Retire le membre du mandat : il garde son compte et la lecture de ses documents, sans plus rien créer. */
export async function retirerDuMandat(acteur: Acteur, affectationId: string): Promise<void> {
  const m = await contexte(acteur);
  const a = await affectationDuMandat(m, affectationId);
  verifierCible(acteur, a);
  await db.delete(schema.affectation).where(eq(schema.affectation.id, a.id));
}

/**
 * Lien d'activation ou de réinitialisation du mot de passe. Un lien donne l'accès au compte : celui d'un
 * membre du bureau n'est remis que par le président, celui d'un administrateur que par un administrateur.
 */
export async function lienPourMembre(acteur: Acteur, userId: string): Promise<string> {
  const m = await contexte(acteur);
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
  if (!u) throw new ErreurOrganisation("Compte introuvable.");
  if (u.estAdministrateur && !acteur.estAdministrateur) throw new ErreurOrganisation("Seul un administrateur peut remettre un lien à un administrateur.");
  const [a] = await db
    .select({ role: schema.affectation.role })
    .from(schema.affectation)
    .where(and(eq(schema.affectation.mandatId, m.id), eq(schema.affectation.userId, userId)));
  if (a && estRoleBureau(a.role) && userId !== acteur.id && !peutToucherAuPresident(acteur))
    throw new ErreurOrganisation("Seul le président peut remettre un lien à un membre du bureau.");
  return nouveauLien(userId, acteur.id);
}

function nomDeDelegation(nom: string): string {
  const n = nom.trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 80) throw new ErreurOrganisation("Le nom d'une délégation fait de 2 à 80 caractères.");
  return n;
}

/** Code du numéro des documents officiels : 2 à 6 lettres ou chiffres, en majuscules ; « BE » est au bureau exécutif. */
export function codeDeDelegation(code: string | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase();
  if (!c) return null;
  if (!/^[A-Z0-9]{2,6}$/.test(c)) throw new ErreurOrganisation("Le code d'une délégation fait de 2 à 6 lettres ou chiffres, sans espace (ex. : COM).");
  if (c === "BE") throw new ErreurOrganisation("« BE » est le code du bureau exécutif.");
  return c;
}

function messageDoublon(e: unknown): string {
  return String((e as { constraint?: string }).constraint ?? (e as { cause?: { constraint?: string } }).cause?.constraint ?? "").includes("code")
    ? "Une autre délégation a déjà ce code."
    : "Une délégation porte déjà ce nom.";
}

export async function creerDelegation(acteur: Acteur, nom: string, code?: string): Promise<string> {
  const m = await contexte(acteur);
  try {
    const [d] = await db
      .insert(schema.delegation)
      .values({ sectionId: m.sectionId, nom: nomDeDelegation(nom), code: codeDeDelegation(code) })
      .returning({ id: schema.delegation.id });
    return d!.id;
  } catch (e) {
    if (estDoublon(e)) throw new ErreurOrganisation(messageDoublon(e));
    throw e;
  }
}

/** Renomme une délégation et fixe son code ; `code` absent : inchangé, vide : retiré. */
export async function renommerDelegation(acteur: Acteur, id: string, nom: string, code?: string): Promise<void> {
  const m = await contexte(acteur);
  try {
    const maj = await db
      .update(schema.delegation)
      .set({ nom: nomDeDelegation(nom), ...(code !== undefined ? { code: codeDeDelegation(code) } : {}) })
      .where(and(eq(schema.delegation.id, id), eq(schema.delegation.sectionId, m.sectionId)))
      .returning({ id: schema.delegation.id });
    if (!maj.length) throw new ErreurOrganisation("Délégation inconnue.");
  } catch (e) {
    if (estDoublon(e)) throw new ErreurOrganisation(messageDoublon(e));
    throw e;
  }
}

/** Archive (ou ressort) une délégation. On n'archive qu'une délégation sans membre dans le mandat en cours. */
export async function archiverDelegation(acteur: Acteur, id: string, archivee: boolean): Promise<void> {
  const m = await contexte(acteur);
  if (archivee) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.affectation)
      .where(and(eq(schema.affectation.delegationId, id), eq(schema.affectation.mandatId, m.id)));
    if (n > 0) throw new ErreurOrganisation(`Réaffecte d'abord ${n > 1 ? `ses ${n} membres` : "son membre"} à une autre délégation.`);
  }
  const maj = await db
    .update(schema.delegation)
    .set({ archivee })
    .where(and(eq(schema.delegation.id, id), eq(schema.delegation.sectionId, m.sectionId)))
    .returning({ id: schema.delegation.id });
  if (!maj.length) throw new ErreurOrganisation("Délégation inconnue.");
}
