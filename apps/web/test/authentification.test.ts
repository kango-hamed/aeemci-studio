/**
 * Parcours d'authentification contre une vraie base Postgres, vidée à chaque lancement.
 * Base fournie par TEST_DATABASE_URL (service Postgres en intégration continue) ; sans elle, ces tests
 * sont sautés.
 */
import pg from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import { migrer } from "../scripts/migrer.ts";
import { creerAdmin } from "../scripts/creer-admin.ts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("authentification (Postgres)", () => {
  let auth: typeof import("@/serveur/auth").auth;
  let affectationCourante: typeof import("@/fonctionnalites/organisation/requetes").affectationCourante;
  let userId: string;

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await c.end();
    await migrer(url!);
    ({ userId } = await creerAdmin(url!, { email: "President@Esatic.edu.ci", nom: "Awa Koné", motDePasse: "mot-de-passe-solide", role: "president", mandat: "2025-2026" }));

    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET = "secret-de-test-secret-de-test-secret";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    ({ auth } = await import("@/serveur/auth"));
    ({ affectationCourante } = await import("@/fonctionnalites/organisation/requetes"));
  });

  it("connecte le compte créé par le script, adresse en minuscules", async () => {
    const r = await auth.api.signInEmail({ body: { email: "president@esatic.edu.ci", password: "mot-de-passe-solide" } });
    expect(r.user.id).toBe(userId);
    expect(r.token).toBeTruthy();
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    const { rows } = await c.query("select user_id from session where token = $1", [r.token]);
    await c.end();
    expect(rows).toEqual([{ user_id: userId }]);
  });

  it("refuse un mauvais mot de passe", async () => {
    await expect(auth.api.signInEmail({ body: { email: "president@esatic.edu.ci", password: "faux-mot-de-passe" } })).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });

  it("refuse l'inscription libre", async () => {
    await expect(auth.api.signUpEmail({ body: { email: "intrus@exemple.com", password: "mot-de-passe-solide", name: "Intrus" } })).rejects.toBeTruthy();
  });

  it("le script est rejouable : il met à jour le mot de passe sans doublon", async () => {
    const r = await creerAdmin(url!, { email: "president@esatic.edu.ci", nom: "Awa Koné", motDePasse: "nouveau-mot-de-passe" });
    expect(r).toEqual({ userId, cree: false });
    await expect(auth.api.signInEmail({ body: { email: "president@esatic.edu.ci", password: "mot-de-passe-solide" } })).rejects.toBeTruthy();
    const ok = await auth.api.signInEmail({ body: { email: "president@esatic.edu.ci", password: "nouveau-mot-de-passe" } });
    expect(ok.user.id).toBe(userId);
  });

  it("donne le rôle du membre dans le mandat en cours", async () => {
    expect(await affectationCourante(userId)).toEqual({ role: "president", mandat: "2025-2026", delegation: null, section: "ESATIC" });
  });
});
