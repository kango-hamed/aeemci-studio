import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { peutGererOrganisation, peutToucherAuPresident, type Acteur } from "./droits";
import { cleDelegation, type LigneImport } from "./import-membres";
import { LIMITES_IDENTITE, lignesEntete, type SaisieIdentite } from "./identite";
import { envoyerLienParCourriel, nouveauLien } from "./invitations";
import { mandatCourant, type MandatCourant } from "./requetes";
import { estRoleBureau, type Role } from "./roles";
import { emailProvisoire } from "./telephone";

/**
 * Gestion de l'organisation par le bureau exécutif : comptes, rôles du mandat en cours, délégations,
 * import du bureau depuis un fichier, papier à en-tête des documents officiels.
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
  if (p.role === "responsable_delegation" && p.delegationId) {
    const [r] = await db
      .select({ nom: schema.user.name })
      .from(schema.affectation)
      .innerJoin(schema.user, eq(schema.user.id, schema.affectation.userId))
      .where(
        and(
          eq(schema.affectation.mandatId, m.id),
          eq(schema.affectation.role, "responsable_delegation"),
          eq(schema.affectation.delegationId, p.delegationId),
          affectationIgnoree ? ne(schema.affectation.id, affectationIgnoree) : undefined,
        ),
      );
    if (r) throw new ErreurOrganisation(`${r.nom} est déjà responsable de cette délégation : nomme ce membre sous-responsable, ou change d'abord le rôle de ${r.nom}.`);
  }
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

/** Papier à en-tête des documents officiels ; un champ vide reprend la valeur par défaut. N'affecte que les rendus suivants. */
export async function modifierIdentite(acteur: Acteur, s: SaisieIdentite): Promise<void> {
  const m = await contexte(acteur);
  const L = LIMITES_IDENTITE;
  const entete = lignesEntete(s.entete);
  if (entete.length > L.lignesEntete) throw new ErreurOrganisation(`L'en-tête compte ${L.lignesEntete} lignes au plus.`);
  if (entete.some((l) => l.length > L.ligne)) throw new ErreurOrganisation(`Chaque ligne de l'en-tête fait ${L.ligne} caractères au plus.`);
  const propre = (v: string | null, max: number, libelle: string) => {
    const t = (v ?? "").trim().replace(/\s+/g, " ");
    if (t.length > max) throw new ErreurOrganisation(`${libelle} : ${max} caractères au plus.`);
    return t || null;
  };
  const email = propre(s.email, L.email, "E-mail");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErreurOrganisation("Saisis une adresse e-mail valide, ou laisse le champ vide.");
  await db
    .update(schema.section)
    .set({
      entete: entete.length ? entete.join("\n") : null,
      rattachement: propre(s.rattachement, L.rattachement, "Ligne du pied de page"),
      email,
      telephones: propre(s.telephones, L.telephones, "Téléphones"),
    })
    .where(eq(schema.section.id, m.sectionId));
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

/** Suite donnée à une ligne d'import : compte créé, ancien membre réaffecté, ou déjà dans le mandat (ignoré). */
export type SuiteImport = "nouveau" | "reaffecte" | "deja";

export interface LigneAnalysee extends LigneImport {
  /** Absente quand la ligne a des erreurs. */
  suite?: SuiteImport;
}

export interface AnalyseImport {
  lignes: LigneAnalysee[];
  /** Délégations que l'import créera. */
  nouvellesDelegations: { nom: string; code: string | null }[];
  valide: boolean;
}

/** Délégation d'une ligne : existante (`id`) ou à créer ; `codeAjoute` : code à donner à une existante qui n'en a pas. */
interface DelegationPrevue {
  id?: string;
  nom: string;
  code: string | null;
  codeAjoute?: string;
}

/** Contrôles qui demandent la base : délégations, comptes existants, président, droits de l'acteur. Rien n'est enregistré. */
async function analyser(acteur: Acteur, m: MandatCourant, lignes: LigneImport[]) {
  const existantes = await db.select().from(schema.delegation).where(eq(schema.delegation.sectionId, m.sectionId));
  const parCle = new Map(existantes.map((d) => [cleDelegation(d.nom), d]));
  const codes = new Map(existantes.filter((d) => d.code).map((d) => [d.code!, cleDelegation(d.nom)]));
  const emails = [...new Set(lignes.map((l) => l.email).filter(Boolean))];
  const comptes = emails.length ? await db.select({ id: schema.user.id, email: schema.user.email }).from(schema.user).where(inArray(schema.user.email, emails)) : [];
  const compteDe = new Map(comptes.map((c) => [c.email, c.id]));
  // Lignes sans e-mail : le compte est celui qui porte ce numéro, s'il n'y en a qu'un.
  const numeros = [...new Set(lignes.filter((l) => !l.email && l.telephone).map((l) => l.telephone))];
  const parNumero = new Map<string, string[]>();
  if (numeros.length)
    for (const c of await db.select({ id: schema.user.id, telephone: schema.user.telephone }).from(schema.user).where(inArray(schema.user.telephone, numeros)))
      parNumero.set(c.telephone!, [...(parNumero.get(c.telephone!) ?? []), c.id]);
  /** Compte existant de chaque ligne (par son numéro de ligne). */
  const existants = new Map<number, string>();
  const affectations = await db
    .select({ userId: schema.affectation.userId, role: schema.affectation.role, delegationId: schema.affectation.delegationId })
    .from(schema.affectation)
    .where(eq(schema.affectation.mandatId, m.id));
  const dansLeMandat = new Set(affectations.map((a) => a.userId));
  let president: number | null = affectations.some((a) => a.role === "president") ? 0 : null;
  // Responsable de chaque délégation : 0 s'il est déjà dans le mandat, sinon la ligne du fichier qui le nomme.
  const responsables = new Map<string, number>();
  for (const a of affectations) {
    const d = a.role === "responsable_delegation" && existantes.find((x) => x.id === a.delegationId);
    if (d) responsables.set(cleDelegation(d.nom), 0);
  }

  const prevues = new Map<string, DelegationPrevue>();
  const analysees = lignes.map((l): LigneAnalysee => {
    const erreurs = [...l.erreurs];
    if (erreurs.length || !l.role) return { ...l, erreurs };
    const homonymes = l.email ? [] : (parNumero.get(l.telephone) ?? []);
    if (homonymes.length > 1) return { ...l, erreurs: ["Plusieurs comptes portent ce numéro : indique l'e-mail du membre."] };
    const userId = l.email ? compteDe.get(l.email) : homonymes[0];
    if (userId) existants.set(l.ligne, userId);
    if (userId && dansLeMandat.has(userId)) return { ...l, erreurs, suite: "deja" };

    if (l.role === "president") {
      if (!peutToucherAuPresident(acteur)) erreurs.push("Seul le président (ou un administrateur) peut confier le rôle de président.");
      else if (president === 0) erreurs.push("Le mandat a déjà un président.");
      else if (president) erreurs.push(`Un seul président : déjà à la ligne ${president}.`);
      else president = l.ligne;
    }
    if (l.delegation) {
      const cle = cleDelegation(l.delegation);
      const existante = parCle.get(cle);
      if (l.role === "responsable_delegation") {
        const deja = responsables.get(cle);
        if (deja === 0) erreurs.push("Cette délégation a déjà un responsable dans le mandat : nomme ce membre sous-responsable.");
        else if (deja) erreurs.push(`Un seul responsable par délégation : déjà à la ligne ${deja}.`);
        else responsables.set(cle, l.ligne);
      }
      let code: string | null = null;
      try {
        if (!existante) nomDeDelegation(l.delegation);
        code = codeDeDelegation(l.code);
      } catch (e) {
        if (!(e instanceof ErreurOrganisation)) throw e;
        erreurs.push(e.message);
      }
      let prevue = prevues.get(cle);
      if (!prevue) {
        prevue = existante ? { id: existante.id, nom: existante.nom, code: existante.code } : { nom: nomPropre(l.delegation), code: null };
        prevues.set(cle, prevue);
      }
      if (existante?.archivee) erreurs.push(`La délégation « ${existante.nom} » est archivée.`);
      if (code && code !== prevue.code) {
        if (prevue.code) erreurs.push(`La délégation « ${prevue.nom} » a déjà le code ${prevue.code}.`);
        else if (codes.has(code)) erreurs.push(`Le code ${code} est déjà pris par une autre délégation.`);
        else {
          prevue.code = code;
          if (prevue.id) prevue.codeAjoute = code;
          codes.set(code, cle);
        }
      }
    }
    return { ...l, erreurs, suite: erreurs.length ? undefined : userId ? "reaffecte" : "nouveau" };
  });
  return { analysees, prevues, existants };
}

const nomPropre = (nom: string) => nom.trim().replace(/\s+/g, " ");

export async function analyserImport(acteur: Acteur, lignes: LigneImport[]): Promise<AnalyseImport> {
  const m = await contexte(acteur);
  const { analysees, prevues } = await analyser(acteur, m, lignes);
  return {
    lignes: analysees,
    nouvellesDelegations: [...prevues.values()].filter((d) => !d.id).map(({ nom, code }) => ({ nom, code })),
    valide: analysees.every((l) => !l.erreurs.length),
  };
}

export interface MembreImporte {
  nom: string;
  /** Vide pour un membre importé avec son seul numéro. */
  email: string;
  telephone: string | null;
  suite: SuiteImport;
  /** Lien d'activation à transmettre, si le compte n'a pas encore de mot de passe. */
  jeton: string | null;
  /** Le lien est parti par e-mail (adresse d'envoi configurée) ; sinon le bureau le transmet. */
  envoye: boolean;
}

/** Envois d'e-mails simultanés à l'import : assez pour 200 lignes en moins d'une minute, sans brusquer le serveur SMTP. */
const ENVOIS_SIMULTANES = 4;

/**
 * Importe le fichier en une fois : délégations manquantes, comptes, rôles du mandat en cours. Tout ou rien :
 * une seule erreur et rien n'est enregistré. Les membres déjà dans le mandat sont laissés tels quels.
 */
export async function importerMembres(acteur: Acteur, lignes: LigneImport[]): Promise<MembreImporte[]> {
  const m = await contexte(acteur);
  const { analysees, prevues, existants } = await analyser(acteur, m, lignes);
  if (analysees.some((l) => l.erreurs.length)) throw new ErreurOrganisation("Le fichier a des erreurs : corrige-les, puis vérifie-le à nouveau.");
  /** Compte de chaque ligne importée (par son numéro de ligne). */
  const comptes = new Map<number, string>();
  try {
    await db.transaction(async (tx) => {
      for (const d of prevues.values()) {
        if (d.id) {
          if (d.codeAjoute) await tx.update(schema.delegation).set({ code: d.codeAjoute }).where(eq(schema.delegation.id, d.id));
          continue;
        }
        const [creee] = await tx.insert(schema.delegation).values({ sectionId: m.sectionId, nom: d.nom, code: d.code }).returning({ id: schema.delegation.id });
        d.id = creee!.id;
      }
      for (const l of analysees) {
        if (l.suite === "deja") continue;
        let userId = existants.get(l.ligne);
        if (!userId) {
          userId = randomUUID();
          await tx.insert(schema.user).values({ id: userId, name: l.nom, email: l.email || emailProvisoire(userId), telephone: l.telephone || null });
        } else if (l.telephone) {
          await tx.update(schema.user).set({ telephone: l.telephone }).where(and(eq(schema.user.id, userId), isNull(schema.user.telephone)));
        }
        const delegationId = l.delegation ? prevues.get(cleDelegation(l.delegation))!.id! : null;
        await tx.insert(schema.affectation).values({ mandatId: m.id, userId, role: l.role!, delegationId, designer: l.designer });
        comptes.set(l.ligne, userId);
      }
    });
  } catch (e) {
    if (estDoublon(e)) throw new ErreurOrganisation("Le mandat ou les délégations ont changé pendant l'import : vérifie à nouveau le fichier.");
    throw e;
  }

  // Liens après l'enregistrement : un lien perdu se régénère depuis la liste des membres.
  const ids = [...comptes.values()];
  const actifs = new Set(
    ids.length
      ? (
          await db
            .select({ userId: schema.account.userId })
            .from(schema.account)
            .where(and(inArray(schema.account.userId, ids), eq(schema.account.providerId, "credential")))
        ).map((c) => c.userId)
      : [],
  );
  const resultat: MembreImporte[] = [];
  for (const l of analysees) {
    const userId = comptes.get(l.ligne);
    resultat.push({ nom: l.nom, email: l.email, telephone: l.telephone || null, suite: l.suite!, jeton: userId && !actifs.has(userId) ? await nouveauLien(userId, acteur.id) : null, envoye: false });
  }
  // Chaque lien part par e-mail ; un envoi raté, ou un membre sans e-mail, reste affiché : à transmettre à la main.
  const aEnvoyer = resultat.filter((r) => r.jeton && r.email);
  for (let i = 0; i < aEnvoyer.length; i += ENVOIS_SIMULTANES) {
    await Promise.all(
      aEnvoyer.slice(i, i + ENVOIS_SIMULTANES).map(async (r) => {
        r.envoye = await envoyerLienParCourriel(r.nom, r.email, r.jeton!);
      }),
    );
  }
  return resultat;
}
