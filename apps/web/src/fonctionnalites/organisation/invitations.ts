import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/serveur/db";

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

export interface LienValide {
  invitationId: string;
  userId: string;
  nom: string;
  email: string;
  /** Le compte a déjà un mot de passe : le lien sert à le remplacer. */
  reinitialisation: boolean;
}

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
  return { ...l, reinitialisation: Boolean(compte) };
}

/**
 * Pose le mot de passe et consomme le lien. Les sessions ouvertes du compte sont fermées : un lien de
 * réinitialisation remis à la place d'un mot de passe perdu coupe aussi un éventuel accès volé.
 * Renvoie l'adresse e-mail, pour la connexion qui suit, ou `null` si le lien n'est plus valable.
 */
export async function utiliserLien(jeton: string, motDePasse: string): Promise<string | null> {
  const l = await lienValide(jeton);
  if (!l) return null;
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
    await tx.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, l.userId));
    await tx.delete(schema.session).where(eq(schema.session.userId, l.userId));
    return true;
  });
  return consomme ? l.email : null;
}
