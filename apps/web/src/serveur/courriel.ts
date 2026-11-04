import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envoi d'e-mails par SMTP (adresse Gmail de la section avec un mot de passe d'application, puis
 * l'adresse du domaine de la section). Sans configuration, rien ne part et rien n'échoue : les liens
 * d'activation restent à transmettre à la main.
 *
 * - `SMTP_HOTE` (ex. smtp.gmail.com), `SMTP_PORT` (465 par défaut : TLS dès la connexion) ;
 * - `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE` : le compte d'envoi ;
 * - `COURRIEL_EXPEDITEUR` : « AEEMCI ESATIC <adresse> » (par défaut : le compte d'envoi).
 */

export interface Courriel {
  a: string;
  sujet: string;
  texte: string;
  html: string;
}

/** Délai au-delà duquel un envoi est abandonné : un serveur SMTP muet ne bloque pas l'import. */
const DELAI_MAX = 20_000;

export function courrielConfigure(): boolean {
  return Boolean(process.env.SMTP_HOTE && process.env.SMTP_UTILISATEUR && process.env.SMTP_MOT_DE_PASSE);
}

let transport: Transporter | null = null;
function transporteur(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOTE,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_UTILISATEUR, pass: process.env.SMTP_MOT_DE_PASSE },
      connectionTimeout: DELAI_MAX,
      greetingTimeout: DELAI_MAX,
      socketTimeout: DELAI_MAX,
    });
  }
  return transport;
}

/** Envoie un e-mail ; `false` s'il n'est pas parti (pas de configuration, adresse refusée, serveur injoignable). N'échoue jamais. */
export async function envoyerCourriel(c: Courriel): Promise<boolean> {
  if (!courrielConfigure()) return false;
  try {
    await transporteur().sendMail({
      from: process.env.COURRIEL_EXPEDITEUR || process.env.SMTP_UTILISATEUR,
      to: c.a,
      subject: c.sujet,
      text: c.texte,
      html: c.html,
    });
    return true;
  } catch (e) {
    console.error(`E-mail non envoyé à ${c.a} :`, e instanceof Error ? e.message : e);
    return false;
  }
}
