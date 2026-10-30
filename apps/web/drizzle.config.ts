import { defineConfig } from "drizzle-kit";

/** `npm run db:generer` : écrit la migration SQL correspondant aux changements de `schema.ts`. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/serveur/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
