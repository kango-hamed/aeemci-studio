import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Une seule connexion partagée par processus (y compris entre les rechargements de `next dev`).
 * `DATABASE_URL` : chaîne Postgres classique (Neon : la chaîne « pooled » avec `sslmode=require`).
 */
const globalPourDb = globalThis as unknown as { pool?: Pool };

// Le pool ne se connecte qu'à la première requête : `next build` peut importer ce module sans base.
// Une variable manquante est signalée par /api/sante et au premier accès à la base.
function creerPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
}

export const pool = globalPourDb.pool ?? creerPool();
if (process.env.NODE_ENV !== "production") globalPourDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
