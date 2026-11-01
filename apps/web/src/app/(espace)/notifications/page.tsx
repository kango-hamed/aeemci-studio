import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { clePublique } from "@/fonctionnalites/notifications/envoi";
import { ReglageNotifications } from "@/fonctionnalites/notifications/ReglageNotifications";
import { db, schema } from "@/serveur/db";

export const metadata: Metadata = { title: "Notifications" };

export default async function PageNotifications() {
  const u = await exigerUtilisateur();
  const [p] = await db.select().from(schema.preferenceNotification).where(eq(schema.preferenceNotification.userId, u.id));
  const role = u.affectation?.role;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Notifications</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          Reçois sur ton téléphone l&apos;essentiel : un document qui t&apos;attend, une décision, un nouveau partage, une activité le lendemain.
        </p>
      </div>
      <ReglageNotifications
        clePublique={clePublique()}
        preferences={{ aValider: p?.aValider ?? true, decision: p?.decision ?? true, partage: p?.partage ?? true, rappel: p?.rappel ?? true }}
        estValideur={role === "president" || role === "vice_president"}
      />
    </>
  );
}
