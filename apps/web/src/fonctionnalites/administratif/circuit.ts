import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";
import { catalogue, cheminDeTeleversement, rendrePageA4 } from "@/fonctionnalites/generation/rendu";
import { ErreurSaisie, visibiliteEffective } from "@/fonctionnalites/documents/creer";
import { peutCreerDocuments, peutModifierDocument, peutValider, type Acteur, type Visibilite } from "@/fonctionnalites/organisation/droits";
import { mandatCourant, type MandatCourant } from "@/fonctionnalites/organisation/requetes";
import { htmlDocument, piedDocument, RESSOURCE_CACHET, type BlocSignature } from "./mise-en-page";
import { controlerContenu, definitionType, LONGUEUR_MAX_CHAMP, titreParDefaut, type DefinitionType, type TypeAdministratif } from "./types";

/**
 * Circuit des documents administratifs.
 *
 * rédaction ──soumettre──▶ soumis ──valider──▶ validé (numéro, signatures, cachet, PDF figé, publié)
 *     ▲                       │
 *     └──── à corriger ◀──────┘ (demande de correction, avec un commentaire)
 *
 * - Jusqu'à la validation, le document est un brouillon (auteur et bureau) avec le filigrane « PROJET ».
 * - Le numéro est pris dans le compteur pendant la transaction de validation : si le rendu échoue,
 *   le compteur revient en arrière et la séquence reste sans trou.
 * - Un document validé ne change plus : le corriger crée une nouvelle version, qui refait le circuit.
 */

const LARGEUR_MINIATURE = 360;
/** Code du bureau exécutif dans les numéros ; une délégation a le sien (Organisation). */
export const CODE_BUREAU = "BE";

const TITRES = {
  president: "Le Président",
  interim: "Le Vice-président, Président par intérim",
  secretaire_seance: "Le Secrétaire de séance",
} as const;

// ── Ressources ─────────────────────────────────────────────────────────────────

function cheminPublic(nom: string): string {
  const candidats = [path.resolve(/*turbopackIgnore: true*/ "public", nom), path.resolve(/*turbopackIgnore: true*/ "apps/web/public", nom)];
  const trouve = candidats.find((c) => existsSync(c));
  if (!trouve) throw new Error(`Ressource introuvable : ${nom}`);
  return trouve;
}

export function ressourcesFixes(): Record<string, string> {
  const c = catalogue();
  const police = (nom: string) => {
    const p = c.trouver(nom);
    if (!p) throw new Error(`Police absente du catalogue : ${nom}`);
    return p.fichier;
  };
  return {
    sceau: cheminPublic("sceau-aeemci.png"),
    croissant: cheminPublic("logo-aeemci-esatic.png"),
    "titre-400": police("Montserrat-Regular"),
    "titre-700": police("Montserrat-Bold"),
    "texte-400": police("Outfit-Regular"),
    "texte-600": police("Outfit-SemiBold"),
  };
}

// ── Lecture ────────────────────────────────────────────────────────────────────

type LigneDocument = typeof schema.document.$inferSelect;

type DocumentRedige = LigneDocument & { typeAdministratif: TypeAdministratif; etatValidation: NonNullable<LigneDocument["etatValidation"]>; fige: boolean };

/** Document rédigé, avec `fige` : rattaché à un mandat clos (lecture seule). */
async function documentRedige(id: string): Promise<DocumentRedige> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ErreurSaisie("Document introuvable.");
  const [l] = await db
    .select({ d: schema.document, fige: sql<boolean>`coalesce(${schema.mandat.statut} = 'clos', false)` })
    .from(schema.document)
    .leftJoin(schema.mandat, eq(schema.document.mandatId, schema.mandat.id))
    .where(eq(schema.document.id, id));
  const d = l?.d;
  if (!d || d.origine !== "redige" || !d.typeAdministratif || !d.etatValidation) throw new ErreurSaisie("Document introuvable.");
  return { ...d, fige: l.fige } as DocumentRedige;
}

const MESSAGE_FIGE = "Ce document appartient à un mandat clos : il est en lecture seule.";

export async function signatureDe(userId: string): Promise<string | null> {
  const [s] = await db.select({ cle: schema.signature.cle }).from(schema.signature).where(eq(schema.signature.userId, userId));
  return s?.cle ?? null;
}

export async function cachetDeSection(sectionId: string): Promise<string | null> {
  const [s] = await db.select({ cachet: schema.section.cachet }).from(schema.section).where(eq(schema.section.id, sectionId));
  return s?.cachet ?? null;
}

async function exigerMandat(): Promise<MandatCourant> {
  const m = await mandatCourant();
  if (!m) throw new ErreurSaisie("Aucun mandat en cours.");
  return m;
}

async function nomDe(userId: string): Promise<string> {
  const [u] = await db.select({ nom: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId));
  return u?.nom ?? "";
}

// ── Rendu ──────────────────────────────────────────────────────────────────────

interface Rendu {
  pdf: Buffer;
  miniature: Buffer;
}

/** Projet (filigrane, sans numéro ni signature), pour la rédaction et la relecture. */
async function rendreProjet(t: DefinitionType, contenu: Record<string, string>, auteurId: string, section: string): Promise<Rendu> {
  const signatures: BlocSignature[] = [{ titre: TITRES.president, nom: "" }];
  if (t.code === "PV") signatures.unshift({ titre: TITRES.secretaire_seance, nom: await nomDe(auteurId) });
  const donnees = { type: t, contenu, numero: null, date: new Date(), section, signatures, projet: true };
  return rendrePageA4({ html: htmlDocument(donnees), ressources: ressourcesFixes(), pied: piedDocument(donnees) }, LARGEUR_MINIATURE);
}

/** Contenu limité aux champs du type, textes nettoyés et bornés. */
function nettoyer(t: DefinitionType, saisi: Record<string, unknown>): Record<string, string> {
  const propre: Record<string, string> = {};
  for (const c of t.champs) {
    const v = saisi[c.nom];
    if (typeof v !== "string") continue;
    const texte = v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
    if (texte) propre[c.nom] = texte.slice(0, LONGUEUR_MAX_CHAMP[c.genre]);
  }
  return propre;
}

async function ecrireRendu(id: string, nom: "projet" | "valide", r: Rendu): Promise<{ fichier: string; miniature: string }> {
  const fichier = `documents/${id}/${nom}.pdf`;
  const miniature = `documents/${id}/miniature.jpg`;
  await stockage().ecrire(fichier, r.pdf, "application/pdf");
  await stockage().ecrire(miniature, r.miniature, "image/jpeg");
  return { fichier, miniature };
}

const nomPdf = (titre: string) => `${titre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "document"}.pdf`;

// ── Rédaction ──────────────────────────────────────────────────────────────────

export interface Redaction {
  /** Absent : nouveau document. */
  id?: string;
  type: string;
  contenu: Record<string, unknown>;
  titre?: string;
  visibilite?: Visibilite;
}

/** Enregistre la rédaction (même incomplète) et refait le projet PDF. */
export async function enregistrerRedaction(u: Acteur, r: Redaction, rattachement: { mandatId: string | null; delegationId: string | null }): Promise<{ id: string }> {
  if (!peutCreerDocuments(u)) throw new ErreurSaisie("Tu n'as pas de rôle dans le mandat en cours.");
  const m = await exigerMandat();
  const existant = r.id ? await documentRedige(r.id) : null;
  if (existant) {
    if (existant.fige) throw new ErreurSaisie(MESSAGE_FIGE);
    if (!peutModifierDocument(u, existant)) throw new ErreurSaisie("Document introuvable.");
    if (existant.etatValidation === "soumis") throw new ErreurSaisie("Ce document attend la validation : il ne se modifie plus. Demande au président de te le renvoyer en correction.");
    if (existant.etatValidation === "valide") throw new ErreurSaisie("Ce document est validé : crée une nouvelle version pour le corriger.");
  }
  const t = definitionType(existant?.typeAdministratif ?? r.type);
  if (!t) throw new ErreurSaisie("Type de document inconnu.");
  const contenu = nettoyer(t, r.contenu);
  const titre = (r.titre?.trim() || titreParDefaut(t, contenu)).slice(0, 200);
  const id = existant?.id ?? randomUUID();
  const rendu = await rendreProjet(t, contenu, existant?.auteurId ?? u.id, m.section);
  const cles = await ecrireRendu(id, "projet", rendu);
  const commun = { titre, contenu, fichier: cles.fichier, miniature: cles.miniature, taille: rendu.pdf.length, nomFichier: nomPdf(titre) };

  if (existant) {
    await db
      .update(schema.document)
      .set({ ...commun, ...(r.visibilite ? { visibilite: visibiliteEffective(r.visibilite, existant.delegationId) } : {}) })
      .where(eq(schema.document.id, id));
  } else {
    await db.insert(schema.document).values({
      ...commun,
      id,
      auteurId: u.id,
      origine: "redige",
      statut: "brouillon",
      visibilite: visibiliteEffective(r.visibilite, rattachement.delegationId),
      typeAdministratif: t.code,
      etatValidation: "redaction",
      type: "application/pdf",
      mandatId: rattachement.mandatId,
      delegationId: rattachement.delegationId,
    });
  }
  return { id };
}

// ── Circuit ────────────────────────────────────────────────────────────────────

async function evenement(
  tx: Pick<typeof db, "insert">,
  documentId: string,
  acteurId: string,
  action: (typeof schema.actionValidation.enumValues)[number],
  commentaire?: string,
) {
  await tx.insert(schema.evenementValidation).values({ documentId, acteurId, action, commentaire: commentaire || null });
}

/** L'auteur (ou le bureau) soumet un document complet à la validation. */
export async function soumettre(u: Acteur, id: string): Promise<void> {
  const d = await documentRedige(id);
  if (d.fige) throw new ErreurSaisie(MESSAGE_FIGE);
  if (!peutModifierDocument(u, d)) throw new ErreurSaisie("Document introuvable.");
  if (d.etatValidation !== "redaction" && d.etatValidation !== "a_corriger") throw new ErreurSaisie("Ce document n'est pas en rédaction.");
  const t = definitionType(d.typeAdministratif)!;
  const erreurs = controlerContenu(t, d.contenu ?? {});
  if (erreurs.length) throw new ErreurSaisie("Le document est incomplet.", erreurs);
  if (t.code === "PV" && !(await signatureDe(d.auteurId)))
    throw new ErreurSaisie(
      d.auteurId === u.id
        ? "Un procès-verbal porte la signature du secrétaire de séance : enregistre d'abord ta signature (page Signature)."
        : "Un procès-verbal porte la signature du secrétaire de séance : son auteur doit d'abord enregistrer sa signature.",
    );
  await db.transaction(async (tx) => {
    const maj = await tx
      .update(schema.document)
      .set({ etatValidation: "soumis" })
      .where(and(eq(schema.document.id, id), sql`${schema.document.etatValidation} in ('redaction', 'a_corriger')`))
      .returning({ id: schema.document.id });
    if (!maj.length) throw new ErreurSaisie("Ce document n'est plus en rédaction.");
    await evenement(tx, id, u.id, "soumis");
  });
}

async function exigerValideur(u: Acteur): Promise<MandatCourant> {
  const m = await exigerMandat();
  if (!peutValider(u, m.interim))
    throw new ErreurSaisie(u.affectation?.role === "vice_president" ? "Le président n'a pas activé l'intérim : la validation lui revient." : "Seul le président valide les documents administratifs.");
  return m;
}

/** Le valideur renvoie le document à son auteur, avec ce qu'il faut corriger. */
export async function demanderCorrection(u: Acteur, id: string, commentaire: string): Promise<void> {
  await exigerValideur(u);
  if ((await documentRedige(id)).fige) throw new ErreurSaisie(MESSAGE_FIGE);
  const texte = commentaire.trim().slice(0, 2000);
  if (!texte) throw new ErreurSaisie("Indique ce qu'il faut corriger.");
  await db.transaction(async (tx) => {
    const maj = await tx
      .update(schema.document)
      .set({ etatValidation: "a_corriger" })
      .where(and(eq(schema.document.id, id), eq(schema.document.origine, "redige"), eq(schema.document.etatValidation, "soumis")))
      .returning({ id: schema.document.id });
    if (!maj.length) throw new ErreurSaisie("Ce document n'attend pas de validation.");
    await evenement(tx, id, u.id, "correction_demandee", texte);
  });
}

/** Code de la délégation du document dans le numéro : « BE » pour le bureau exécutif. */
async function codeDuDocument(d: LigneDocument): Promise<string> {
  if (!d.delegationId) return CODE_BUREAU;
  const [del] = await db.select({ nom: schema.delegation.nom, code: schema.delegation.code }).from(schema.delegation).where(eq(schema.delegation.id, d.delegationId));
  if (!del?.code) throw new ErreurSaisie(`La délégation « ${del?.nom ?? "?"} » n'a pas encore de code pour les numéros : ajoute-le dans Organisation.`);
  return del.code;
}

/** Année civile à Abidjan (UTC toute l'année). */
const anneeCivile = (d: Date) => d.getUTCFullYear();

export function formaterNumero(section: string, code: string, type: TypeAdministratif, annee: number, rang: number): string {
  const s = section.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  return `AEEMCI-${s}/${code}/${type}/${annee}/${String(rang).padStart(3, "0")}`;
}

/** Valide : numéro, signatures et cachet, PDF définitif, publication. */
export async function valider(u: Acteur, id: string): Promise<{ numero: string }> {
  const m = await exigerValideur(u);
  const d = await documentRedige(id);
  if (d.fige) throw new ErreurSaisie(MESSAGE_FIGE);
  if (d.etatValidation !== "soumis") throw new ErreurSaisie("Ce document n'attend pas de validation.");
  const t = definitionType(d.typeAdministratif)!;
  const erreurs = controlerContenu(t, d.contenu ?? {});
  if (erreurs.length) throw new ErreurSaisie("Le document est incomplet.", erreurs);

  const signatureValideur = await signatureDe(u.id);
  if (!signatureValideur) throw new ErreurSaisie("Enregistre d'abord ta signature (page Signature) : elle est apposée à la validation.");
  const cachet = await cachetDeSection(m.sectionId);
  if (!cachet) throw new ErreurSaisie("Le cachet de la section n'est pas encore enregistré (page Signature, réservé au président).");
  const signatureAuteur = t.code === "PV" ? await signatureDe(d.auteurId) : null;
  if (t.code === "PV" && !signatureAuteur) throw new ErreurSaisie("Le secrétaire de séance n'a pas de signature enregistrée.");
  const code = await codeDuDocument(d);

  const role: "president" | "interim" = u.affectation?.role === "president" ? "president" : "interim";
  const signataires: schema.Signataire[] = [{ role, userId: u.id, nom: await nomDe(u.id) }];
  if (t.code === "PV") signataires.unshift({ role: "secretaire_seance", userId: d.auteurId, nom: await nomDe(d.auteurId) });
  const ressources: Record<string, string> = { ...ressourcesFixes(), [RESSOURCE_CACHET]: await cheminDeTeleversement(cachet) };
  const blocs: BlocSignature[] = [];
  for (const [i, s] of signataires.entries()) {
    const cle = s.role === "secretaire_seance" ? signatureAuteur! : signatureValideur;
    ressources[`signature-${i}`] = await cheminDeTeleversement(cle);
    blocs.push({ titre: TITRES[s.role], nom: s.nom, signature: `signature-${i}`, cachet: s.role !== "secretaire_seance" });
  }

  const maintenant = new Date();
  const annee = anneeCivile(maintenant);
  return db.transaction(async (tx) => {
    // Verrou sur le document : deux validations simultanées ne prennent pas deux numéros.
    const [verrou] = await tx.select({ etat: schema.document.etatValidation }).from(schema.document).where(eq(schema.document.id, id)).for("update");
    if (verrou?.etat !== "soumis") throw new ErreurSaisie("Ce document n'attend plus de validation.");
    const [c] = await tx
      .insert(schema.compteur)
      .values({ sectionId: m.sectionId, delegation: code, type: t.code, annee, dernier: 1 })
      .onConflictDoUpdate({
        target: [schema.compteur.sectionId, schema.compteur.delegation, schema.compteur.type, schema.compteur.annee],
        set: { dernier: sql`${schema.compteur.dernier} + 1` },
      })
      .returning({ dernier: schema.compteur.dernier });
    const numero = formaterNumero(m.section, code, t.code, annee, c!.dernier);
    const donnees = { type: t, contenu: d.contenu ?? {}, numero, date: maintenant, section: m.section, signatures: blocs, projet: false };
    const rendu = await rendrePageA4({ html: htmlDocument(donnees), ressources, pied: piedDocument(donnees) }, LARGEUR_MINIATURE);
    const cles = await ecrireRendu(id, "valide", rendu);
    await tx
      .update(schema.document)
      .set({
        etatValidation: "valide",
        statut: "publie",
        numero,
        valideLe: maintenant,
        valideParId: u.id,
        signataires,
        fichier: cles.fichier,
        miniature: cles.miniature,
        taille: rendu.pdf.length,
        nomFichier: nomPdf(numero.replace(/\//g, "-")),
      })
      .where(eq(schema.document.id, id));
    await evenement(tx, id, u.id, "valide");
    return { numero };
  });
}

/** Corrige un document validé : une nouvelle version en rédaction, l'ancienne reste valable et figée. */
export async function nouvelleVersion(u: Acteur, id: string, rattachement: { mandatId: string | null; delegationId: string | null }): Promise<{ id: string }> {
  const d = await documentRedige(id);
  if (d.fige) throw new ErreurSaisie(MESSAGE_FIGE);
  if (!peutModifierDocument(u, d)) throw new ErreurSaisie("Document introuvable.");
  if (d.etatValidation !== "valide") throw new ErreurSaisie("Seul un document validé se corrige par une nouvelle version.");
  const nouveau = await enregistrerRedaction(
    u,
    { type: d.typeAdministratif, contenu: d.contenu ?? {}, titre: d.titre, visibilite: d.visibilite },
    { mandatId: rattachement.mandatId, delegationId: d.delegationId },
  );
  await db.update(schema.document).set({ versionDeId: d.id }).where(eq(schema.document.id, nouveau.id));
  await evenement(db, d.id, u.id, "nouvelle_version");
  return nouveau;
}

// ── Historique ─────────────────────────────────────────────────────────────────

export interface EvenementAffiche {
  action: (typeof schema.actionValidation.enumValues)[number];
  commentaire: string | null;
  acteur: string | null;
  date: Date;
}

export async function historique(documentId: string): Promise<EvenementAffiche[]> {
  const e = schema.evenementValidation;
  return db
    .select({ action: e.action, commentaire: e.commentaire, acteur: schema.user.name, date: e.createdAt })
    .from(e)
    .leftJoin(schema.user, eq(e.acteurId, schema.user.id))
    .where(eq(e.documentId, documentId))
    .orderBy(asc(e.createdAt));
}

/** Version corrigée d'un document validé, s'il y en a une. */
export async function versionSuivante(documentId: string): Promise<string | null> {
  const [v] = await db.select({ id: schema.document.id }).from(schema.document).where(eq(schema.document.versionDeId, documentId)).limit(1);
  return v?.id ?? null;
}
