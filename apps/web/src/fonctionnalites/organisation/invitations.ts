import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { envoyerCourriel } from "@/serveur/courriel";
import { db, schema } from "@/serveur/db";
import { estEmailProvisoire } from "./telephone";

/** Durée de validité d'un lien d'activation ou de réinitialisation. */
export const VALIDITE_LIEN_JOURS = 7;

const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

/**
 * Nouveau lien pour le membre : les liens précédents non utilisés sont annulés.
 * Le jeton n'est rendu qu'ici, jamais stocké en clair : le bureau le transmet (WhatsApp…).
 */
export async function nouveauLien(userId: string, creeParId: string | null): Promise<string> {
  const jeton = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.delete(schema.invitation).where(and(eq(schema.invitation.userId, userId), isNull(schema.invitation.utiliseeLe)));
    await tx.insert(schema.invitation).values({
      userId,
      empreinte: empreinte(jeton),
      expireLe: new Date(Date.now() + VALIDITE_LIEN_JOURS * 24 * 3600 * 1000),
      creeParId,
    });
  });
  return jeton;
}

const echapper = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Message d'activation envoyé par e-mail : le lien vers l'adresse publique (`BETTER_AUTH_URL`) de la plateforme. */
export function courrielActivation(nom: string, email: string, jeton: string, section = "AEEMCI ESATIC") {
  const adresse = `${(process.env.BETTER_AUTH_URL || "").replace(/\/+$/, "")}/activer/${jeton}`;
  const texte = [
    `Salam ${nom},`,
    "",
    `Le bureau de l'${section} t'a ouvert un compte sur AEEMCI Studio.`,
    "Choisis ton mot de passe ici :",
    adresse,
    "",
    `Ce lien sert une seule fois et reste valable ${VALIDITE_LIEN_JOURS} jours. Ne le transfère à personne.`,
    "Si tu ne connais pas l'AEEMCI, ignore ce message.",
  ].join("\n");
  const html = `<p>Salam ${echapper(nom)},</p>
<p>Le bureau de l'${echapper(section)} t'a ouvert un compte sur AEEMCI Studio.</p>
<p><a href="${echapper(adresse)}" style="display:inline-block;padding:12px 20px;background:#1a6012;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Choisir mon mot de passe</a></p>
<p style="color:#555;font-size:14px">Ce lien sert une seule fois et reste valable ${VALIDITE_LIEN_JOURS} jours. Ne le transfère à personne.<br>Si tu ne connais pas l'AEEMCI, ignore ce message.</p>`;
  return { a: email, sujet: "Ton accès à AEEMCI Studio", texte, html };
}

/** Envoie le lien d'activation par e-mail ; `false` s'il n'est pas parti (le bureau le transmet alors lui-même). */
export function envoyerLienParCourriel(nom: string, email: string, jeton: string): Promise<boolean> {
  return envoyerCourriel(courrielActivation(nom, email, jeton));
}

export interface LienValide {
  invitationId: string;
  userId: string;
  nom: string;
  email: string;
  /** Le compte a déjà un mot de passe : le lien sert à le remplacer. */
  reinitialisation: boolean;
  /** Compte créé avec un seul numéro de téléphone : le membre donne son e-mail en l'activant. */
  emailASaisir: boolean;
}

/** Saisie refusée à l'activation : le message se montre tel quel au membre, et le lien reste utilisable. */
export class ErreurActivation extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lien utilisable (ni expiré, ni déjà utilisé), ou `null`. */
export async function lienValide(jeton: string): Promise<LienValide | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(jeton)) return null;
  const [l] = await db
    .select({ invitationId: schema.invitation.id, userId: schema.user.id, nom: schema.user.name, email: schema.user.email })
    .from(schema.invitation)
    .innerJoin(schema.user, eq(schema.invitation.userId, schema.user.id))
    .where(and(eq(schema.invitation.empreinte, empreinte(jeton)), isNull(schema.invitation.utiliseeLe), gt(schema.invitation.expireLe, new Date())));
  if (!l) return null;
  const [compte] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, l.userId), eq(schema.account.providerId, "credential")));
  return { ...l, reinitialisation: Boolean(compte), emailASaisir: estEmailProvisoire(l.email) };
}

/**
 * Pose le mot de passe et consomme le lien. Les sessions ouvertes du compte sont fermées : un lien de
 * réinitialisation remis à la place d'un mot de passe perdu coupe aussi un éventuel accès volé.
 * Renvoie l'adresse e-mail, pour la connexion qui suit, ou `null` si le lien n'est plus valable.
 * `emailSaisi` : l'adresse du membre, attendue quand son compte n'en a pas encore (`emailASaisir`).
 */
export async function utiliserLien(jeton: string, motDePasse: string, emailSaisi?: string): Promise<string | null> {
  const l = await lienValide(jeton);
  if (!l) return null;
  let email = l.email;
  if (l.emailASaisir) {
    email = (emailSaisi ?? "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 120 || estEmailProvisoire(email)) throw new ErreurActivation("Saisis ton adresse e-mail : elle te servira à te connecter.");
    const [pris] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
    if (pris) throw new ErreurActivation("Cette adresse e-mail a déjà un compte. Donnes-en une autre, ou demande au bureau de vérifier.");
  }
  const hash = await hashPassword(motDePasse);
  const consomme = await db.transaction(async (tx) => {
    const [maj] = await tx
      .update(schema.invitation)
      .set({ utiliseeLe: new Date() })
      .where(and(eq(schema.invitation.id, l.invitationId), isNull(schema.invitation.utiliseeLe)))
      .returning({ id: schema.invitation.id });
    if (!maj) return false; // utilisé entre-temps (double envoi)
    const [compte] = await tx
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, l.userId), eq(schema.account.providerId, "credential")));
    if (compte) await tx.update(schema.account).set({ password: hash }).where(eq(schema.account.id, compte.id));
    else await tx.insert(schema.account).values({ id: randomUUID(), userId: l.userId, accountId: l.userId, providerId: "credential", password: hash });
    await tx.update(schema.user).set({ email, emailVerified: true }).where(eq(schema.user.id, l.userId));
    await tx.delete(schema.session).where(eq(schema.session.userId, l.userId));
    return true;
  });
  return consomme ? email : null;
}
