/**
 * Crée (ou met à jour) un compte administrateur de la plateforme : le premier compte, avant que le
 * bureau puisse créer les autres depuis l'application (lot 2).
 *
 * Usage :
 *   npm run admin:creer -- --email prenom.nom@esatic.edu.ci --nom "Prénom Nom" [--role president] [--mandat 2025-2026]
 *
 * Le mot de passe est demandé au clavier (ou lu dans ADMIN_MOT_DE_PASSE pour un script).
 * Avec --role, le compte reçoit aussi ce rôle dans le mandat indiqué de la section ESATIC
 * (section et mandat créés s'ils n'existent pas).
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import readline from "node:readline";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/serveur/db/schema.ts";

const ROLES = schema.role.enumValues;
type Role = (typeof ROLES)[number];

export interface DemandeAdmin {
  email: string;
  nom: string;
  motDePasse: string;
  role?: Role;
  mandat?: string;
  section?: string;
}

/** Mandat de l'année universitaire en cours : « 2026-2027 » à partir de septembre 2026. */
export function mandatParDefaut(date = new Date()): string {
  const a = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return `${a}-${a + 1}`;
}

export async function creerAdmin(url: string, d: DemandeAdmin): Promise<{ userId: string; cree: boolean }> {
  if (d.motDePasse.length < 10) throw new Error("Le mot de passe doit faire 10 caractères au moins.");
  const email = d.email.trim().toLowerCase();
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });
  try {
    return await db.transaction(async (tx) => {
      const hash = await hashPassword(d.motDePasse);
      const [existant] = await tx.select().from(schema.user).where(eq(schema.user.email, email));
      let userId: string;
      if (existant) {
        userId = existant.id;
        await tx.update(schema.user).set({ name: d.nom, estAdministrateur: true }).where(eq(schema.user.id, userId));
        const [compte] = await tx
          .select()
          .from(schema.account)
          .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")));
        if (compte) await tx.update(schema.account).set({ password: hash }).where(eq(schema.account.id, compte.id));
        else await tx.insert(schema.account).values({ id: randomUUID(), userId, accountId: userId, providerId: "credential", password: hash });
      } else {
        userId = randomUUID();
        await tx.insert(schema.user).values({ id: userId, name: d.nom, email, emailVerified: true, estAdministrateur: true });
        await tx.insert(schema.account).values({ id: randomUUID(), userId, accountId: userId, providerId: "credential", password: hash });
      }

      if (d.role) {
        const nomSection = d.section ?? "ESATIC";
        const libelle = d.mandat ?? mandatParDefaut();
        await tx.insert(schema.section).values({ nom: nomSection }).onConflictDoNothing();
        const [sec] = await tx.select().from(schema.section).where(eq(schema.section.nom, nomSection));
        await tx.insert(schema.mandat).values({ sectionId: sec!.id, libelle }).onConflictDoNothing();
        const [man] = await tx
          .select()
          .from(schema.mandat)
          .where(and(eq(schema.mandat.sectionId, sec!.id), eq(schema.mandat.libelle, libelle)));
        await tx
          .insert(schema.affectation)
          .values({ mandatId: man!.id, userId, role: d.role })
          .onConflictDoUpdate({ target: [schema.affectation.mandatId, schema.affectation.userId], set: { role: d.role } });
      }
      return { userId, cree: !existant };
    });
  } finally {
    await pool.end();
  }
}

function demanderMotDePasse(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const rlInterne = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let masquer = false;
    rlInterne._writeToOutput = (s: string) => {
      if (!masquer || s.includes("\n")) rlInterne.output.write(masquer ? "\n" : s);
    };
    rl.question(question, (r) => {
      rl.close();
      resolve(r);
    });
    masquer = true;
  });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      nom: { type: "string" },
      role: { type: "string" },
      mandat: { type: "string" },
    },
  });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL n'est pas défini (voir apps/web/.env.exemple).");
    process.exit(1);
  }
  if (!values.email || !values.nom) {
    console.error('Usage : npm run admin:creer -- --email adresse@exemple.ci --nom "Prénom Nom" [--role president] [--mandat 2025-2026]');
    process.exit(1);
  }
  if (values.role && !ROLES.includes(values.role as Role)) {
    console.error(`Rôle inconnu « ${values.role} ». Rôles possibles : ${ROLES.join(", ")}.`);
    process.exit(1);
  }
  const motDePasse = process.env.ADMIN_MOT_DE_PASSE ?? (await demanderMotDePasse("Mot de passe (10 caractères au moins) : "));
  try {
    const r = await creerAdmin(url, { email: values.email, nom: values.nom, motDePasse, role: values.role as Role | undefined, mandat: values.mandat });
    console.log(r.cree ? `Compte administrateur créé pour ${values.email}.` : `Compte ${values.email} mis à jour (administrateur, nouveau mot de passe).`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
