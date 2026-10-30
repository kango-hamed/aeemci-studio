import { sql } from "drizzle-orm";
import { db } from "@/serveur/db";

/** Sonde de santé pour l'hébergeur : l'application répond, la base est joignable, la configuration est complète. */
export async function GET() {
  const requises = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
  if (process.env.STOCKAGE === "r2") requises.push("R2_COMPTE", "R2_CLE", "R2_SECRET", "R2_SEAU");
  const manquantes = requises.filter((v) => !process.env[v]);
  if (manquantes.length) return Response.json({ etat: "configuration incomplète", manquantes }, { status: 503 });
  const avertissements =
    process.env.NODE_ENV === "production" && process.env.STOCKAGE !== "r2"
      ? ["Stockage local : les fichiers sont perdus à chaque redémarrage du conteneur. Configurer STOCKAGE=r2."]
      : [];
  try {
    await db.execute(sql`select 1`);
    return Response.json({ etat: "ok", stockage: process.env.STOCKAGE === "r2" ? "r2" : "local", avertissements });
  } catch {
    return Response.json({ etat: "base injoignable" }, { status: 503 });
  }
}
