/**
 * Numéro de téléphone d'un membre : il sert à lui écrire sur WhatsApp, et tient lieu d'adresse à
 * l'import tant que le membre n'a pas donné son e-mail. Module sans dépendance serveur.
 */

/** Indicatif ajouté aux numéros écrits sans indicatif (Côte d'Ivoire : dix chiffres, zéro compris). */
const INDICATIF = "225";

/**
 * Forme enregistrée : les chiffres seuls, indicatif compris (« 07 69 89 37 40 » → « 2250769893740 »).
 * `null` si la saisie n'est pas un numéro ; une adresse wa.me est acceptée.
 */
export function numeroPropre(saisie: string): string | null {
  const texte = saisie.trim().replace(/^https?:\/\/wa\.me\//i, "+");
  if (/[^\d\s+().-]/.test(texte)) return null;
  const international = /^(\+|00)/.test(texte);
  const chiffres = texte.replace(/\D/g, "").replace(international ? /^00/ : /^$/, "");
  if (chiffres.startsWith(INDICATIF) && (international || chiffres.length !== 10)) return chiffres.length === 13 ? chiffres : null;
  if (international) return chiffres.length >= 8 && chiffres.length <= 15 ? chiffres : null;
  return chiffres.length === 10 ? INDICATIF + chiffres : null;
}

/** « 2250769893740 » → « +225 07 69 89 37 40 ». */
export function numeroAffiche(numero: string): string {
  if (numero.length === 13 && numero.startsWith(INDICATIF)) return `+${INDICATIF} ${numero.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  return `+${numero}`;
}

/** Discussion WhatsApp avec le membre, message déjà écrit ; sans numéro, WhatsApp demande à qui l'envoyer. */
export function lienWhatsApp(numero: string | null | undefined, message: string): string {
  return `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(message)}`;
}

const DOMAINE_PROVISOIRE = "sans-email.invalid";

/** Adresse d'attente d'un compte créé sans e-mail : le membre donne la sienne en activant son compte. */
export const emailProvisoire = (userId: string) => `${userId}@${DOMAINE_PROVISOIRE}`;

export const estEmailProvisoire = (email: string) => email.endsWith(`@${DOMAINE_PROVISOIRE}`);

/** Ce qu'on affiche sous le nom d'un membre : son e-mail, ou son numéro tant qu'il n'en a pas donné. */
export function coordonnee(email: string, telephone: string | null | undefined): string {
  if (email && !estEmailProvisoire(email)) return email;
  return telephone ? `${numeroAffiche(telephone)} · sans e-mail` : "Sans e-mail";
}
