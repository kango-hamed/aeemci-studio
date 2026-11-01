"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { db, schema } from "@/serveur/db";
import { envoyerAuxAppareils, notificationsConfigurees } from "./envoi";

const Abonnement = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Enregistre l'appareil courant ; un appareil déjà connu (autre membre avant) passe au membre connecté. */
export async function abonner(abonnement: unknown, appareil: string): Promise<{ erreur?: string }> {
  const u = await exigerUtilisateur();
  const a = Abonnement.safeParse(abonnement);
  if (!a.success || !a.data.endpoint.startsWith("https://")) return { erreur: "Abonnement refusé par le navigateur." };
  const valeurs = { userId: u.id, endpoint: a.data.endpoint, p256dh: a.data.keys.p256dh, auth: a.data.keys.auth, appareil: appareil.slice(0, 80) || null };
  await db
    .insert(schema.abonnementNotification)
    .values(valeurs)
    .onConflictDoUpdate({ target: schema.abonnementNotification.endpoint, set: valeurs });
  return {};
}

export async function desabonner(endpoint: string): Promise<void> {
  const u = await exigerUtilisateur();
  await db.delete(schema.abonnementNotification).where(and(eq(schema.abonnementNotification.userId, u.id), eq(schema.abonnementNotification.endpoint, endpoint)));
}

/** Notification d'essai sur tous les appareils du membre. Renvoie le nombre d'appareils qui l'ont reçue. */
export async function essayer(): Promise<{ recus: number; erreur?: string }> {
  const u = await exigerUtilisateur();
  if (!notificationsConfigurees()) return { recus: 0, erreur: "Les notifications ne sont pas configurées sur le serveur." };
  const appareils = await db.select().from(schema.abonnementNotification).where(eq(schema.abonnementNotification.userId, u.id));
  const recus = await envoyerAuxAppareils(appareils, { titre: "AEEMCI Studio", corps: "Les notifications fonctionnent sur cet appareil.", url: "/notifications", etiquette: "essai" });
  return { recus };
}

const Preferences = z.object({ aValider: z.boolean(), decision: z.boolean(), partage: z.boolean(), rappel: z.boolean() });
export type PreferencesNotification = z.infer<typeof Preferences>;

export async function enregistrerPreferences(p: PreferencesNotification): Promise<void> {
  const u = await exigerUtilisateur();
  const v = Preferences.parse(p);
  await db
    .insert(schema.preferenceNotification)
    .values({ userId: u.id, ...v })
    .onConflictDoUpdate({ target: schema.preferenceNotification.userId, set: v });
}
