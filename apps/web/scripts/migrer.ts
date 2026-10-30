/**
 * Applique les migrations SQL de `drizzle/` à la base `DATABASE_URL`.
 * Usage : npm run db:migrer   (lit apps/web/.env s'il existe)
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export async function migrer(url: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(import.meta.dirname, "../drizzle") });
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL n'est pas défini (voir apps/web/.env.exemple).");
    process.exit(1);
  }
  await migrer(url);
  console.log("Base à jour.");
}
