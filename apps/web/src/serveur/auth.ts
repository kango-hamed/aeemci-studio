import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "./db";

/**
 * Authentification (Better Auth, hébergé dans l'application).
 *
 * - Connexion par e-mail et mot de passe ; **pas d'inscription libre** : les comptes sont créés par le
 *   bureau (lot 2) ou, pour le premier administrateur, par `npm run admin:creer`.
 * - Session dans un cookie httpOnly signé ; durée 30 jours, prolongée à l'usage.
 * - Variables : `BETTER_AUTH_SECRET` (32 caractères aléatoires au moins), `BETTER_AUTH_URL` (adresse publique).
 */
// Pendant `next build` (CI, image Docker), aucun secret n'est fourni : une valeur de construction
// évite de fausses erreurs. À l'exécution, un secret manquant reste bloquant (Better Auth refuse de démarrer).
const secret =
  process.env.BETTER_AUTH_SECRET ??
  (process.env.NEXT_PHASE === "phase-production-build" ? "valeur-de-construction-jamais-utilisee-en-production" : undefined);

export const auth = betterAuth({
  appName: "AEEMCI Studio",
  secret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      estAdministrateur: { type: "boolean", defaultValue: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  // Doit rester le dernier : pose les cookies depuis les actions serveur de Next.js.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
