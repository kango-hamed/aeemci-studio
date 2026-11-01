import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/serveur/db";

/**
 * Envoi des notifications (Web Push, clés VAPID). Sans clés configurées, rien ne part et rien n'échoue :
 * la plateforme fonctionne sans notifications (développement, tests).
 *
 * - `VAPID_PUBLIQUE`, `VAPID_PRIVEE` : paire de clés, générée une fois (`npx web-push generate-vapid-keys`).
 * - `VAPID_CONTACT` : adresse du responsable (`mailto:…`), transmise aux services de notification.
 */

export type GenreNotification = "aValider" | "decision" | "partage" | "rappel";

export interface Notification {
  titre: string;
  corps: string;
  /** Page ouverte quand on touche la notification. */
  url: string;
  /** Une notification de même étiquette remplace la précédente sur l'appareil (série de dépôts…). */
  etiquette?: string;
}

/** Délai d'envoi au-delà duquel on n'attend plus les services de notification. */
const DELAI_MAX = 5000;
/** Durée de conservation par le service quand l'appareil est éteint. */
const DUREE_VIE = 24 * 3600;

export function clePublique(): string | null {
  return process.env.VAPID_PUBLIQUE || null;
}

export function notificationsConfigurees(): boolean {
  return Boolean(process.env.VAPID_PUBLIQUE && process.env.VAPID_PRIVEE);
}

let configure = false;
function configurer() {
  if (configure) return;
  webpush.setVapidDetails(process.env.VAPID_CONTACT || "mailto:contact@aeemci-esatic.ci", process.env.VAPID_PUBLIQUE!, process.env.VAPID_PRIVEE!);
  configure = true;
}

/** Membres qui veulent ce genre de notification (sans préférence enregistrée : tous les genres). */
async function filtrerParPreference(userIds: string[], genre: GenreNotification): Promise<string[]> {
  if (!userIds.length) return [];
  const p = schema.preferenceNotification;
  const refus = await db.select({ userId: p.userId, ok: p[genre] }).from(p).where(inArray(p.userId, userIds));
  const non = new Set(refus.filter((r) => !r.ok).map((r) => r.userId));
  return userIds.filter((id) => !non.has(id));
}

/**
 * Envoie une notification à chaque appareil des membres indiqués qui l'acceptent. Un appareil que le
 * service ne connaît plus (désinstallé, permission retirée) est oublié. N'échoue jamais : une notification
 * perdue ne doit pas faire échouer l'action qui l'a déclenchée.
 */
export async function notifier(userIds: string[], genre: GenreNotification, n: Notification): Promise<void> {
  if (!notificationsConfigurees()) return;
  try {
    const destinataires = await filtrerParPreference([...new Set(userIds)], genre);
    if (!destinataires.length) return;
    const appareils = await db.select().from(schema.abonnementNotification).where(inArray(schema.abonnementNotification.userId, destinataires));
    await envoyerAuxAppareils(appareils, n);
  } catch (e) {
    console.error("Notifications :", e);
  }
}

type Appareil = typeof schema.abonnementNotification.$inferSelect;

export async function envoyerAuxAppareils(appareils: Appareil[], n: Notification): Promise<number> {
  if (!notificationsConfigurees() || !appareils.length) return 0;
  configurer();
  const charge = JSON.stringify({ titre: n.titre, corps: n.corps, url: n.url, etiquette: n.etiquette });
  let recus = 0;
  const envois = appareils.map(async (a) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: DUREE_VIE, urgency: "normal", timeout: DELAI_MAX });
      recus++;
    } catch (e) {
      const statut = (e as { statusCode?: number }).statusCode;
      if (statut === 404 || statut === 410) await db.delete(schema.abonnementNotification).where(eq(schema.abonnementNotification.id, a.id));
      else console.error("Notification non remise :", statut ?? e);
    }
  });
  await Promise.race([Promise.allSettled(envois), new Promise((ok) => setTimeout(ok, DELAI_MAX + 500))]);
  return recus;
}
