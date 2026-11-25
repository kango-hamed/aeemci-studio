import { sql } from "drizzle-orm";
import { db } from "@/serveur/db";

/**
 * Sonde de santé : l'application répond, la configuration est complète, la base est joignable.
 *
 * `?base=non` (healthcheck Docker, toutes les 30 s) : la base n'est pas interrogée, sinon Neon ne se met
 * jamais en veille et le quota de calcul de l'offre gratuite s'épuise en deux semaines (doc 10, « Réglages
 * et coûts »). Sans paramètre (vérification à la main, doc 10) : `select 1` sur la base.
 */
export async function GET(requete: Request) {
  const requises = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
  if (process.env.STOCKAGE === "r2") requises.push("R2_COMPTE", "R2_CLE", "R2_SECRET", "R2_SEAU");
  const manquantes = requises.filter((v) => !process.env[v]);
  if (manquantes.length) return Response.json({ etat: "configuration incomplète", manquantes }, { status: 503 });
  if (new URL(requete.url).searchParams.get("base") === "non") return Response.json({ etat: "ok", base: "non vérifiée" });
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
