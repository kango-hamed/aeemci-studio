import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { peutCloreMandat, type Acteur } from "@/fonctionnalites/organisation/droits";
import { nouveauLien } from "@/fonctionnalites/organisation/invitations";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

export interface Cloture {
  /** Libellé du mandat suivant : « 2027-2028 ». */
  libelle: string;
  /** Président du mandat suivant : compte existant (même adresse) ou nouveau compte. */
  nom: string;
  email: string;
}

/**
 * Clôture du mandat en cours et ouverture du suivant, d'un seul tenant :
 * - l'ancien mandat passe en lecture seule (documents, activités, notes de passation) ;
 * - le nouveau mandat démarre avec son seul président, qui compose ensuite son bureau et ses délégations ;
 * - les délégations, gabarits, signatures et compteurs de numéros sont conservés.
 * `jeton` : lien d'activation à remettre au nouveau président s'il n'a pas encore de mot de passe.
 */
export async function cloreMandat(u: Acteur, c: Cloture): Promise<{ mandatId: string; clos: string; jeton: string | null; nom: string }> {
  if (!peutCloreMandat(u)) throw new ErreurSaisie("Seul le président clôt le mandat.");
  const ancien = await mandatCourant();
  if (!ancien) throw new ErreurSaisie("Aucun mandat en cours.");
  const libelle = c.libelle.trim().replace(/\s+/g, " ");
  if (libelle.length < 4 || libelle.length > 40) throw new ErreurSaisie("Nomme le nouveau mandat, par exemple « 2027-2028 ».");
  if (libelle === ancien.libelle) throw new ErreurSaisie("Le nouveau mandat doit porter un autre nom que celui qui se termine.");
  const email = c.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErreurSaisie("Saisis l'adresse e-mail du nouveau président.");
  const nom = c.nom.trim().replace(/\s+/g, " ");

  const [deja] = await db
    .select({ id: schema.mandat.id })
    .from(schema.mandat)
    .where(and(eq(schema.mandat.sectionId, ancien.sectionId), eq(schema.mandat.libelle, libelle)));
  if (deja) throw new ErreurSaisie(`Le mandat « ${libelle} » existe déjà (archives).`);

  const [existant] = await db.select({ id: schema.user.id, nom: schema.user.name }).from(schema.user).where(eq(schema.user.email, email));
  if (!existant && nom.length < 2) throw new ErreurSaisie("Saisis le nom du nouveau président.");
  const userId = existant?.id ?? randomUUID();
  const maintenant = new Date();

  const mandatId = await db.transaction(async (tx) => {
    // Seul le mandat lu plus haut se clôt : une double soumission ne clôt pas le suivant.
    const clos = await tx
      .update(schema.mandat)
      .set({ statut: "clos", fin: maintenant, interim: false })
      .where(and(eq(schema.mandat.id, ancien.id), eq(schema.mandat.statut, "en_cours")))
      .returning({ id: schema.mandat.id });
    if (!clos.length) throw new ErreurSaisie("Ce mandat vient déjà d'être clos.");
    const [m] = await tx.insert(schema.mandat).values({ sectionId: ancien.sectionId, libelle, debut: maintenant }).returning({ id: schema.mandat.id });
    if (!existant) await tx.insert(schema.user).values({ id: userId, name: nom, email });
    await tx.insert(schema.affectation).values({ mandatId: m!.id, userId, role: "president" });
    return m!.id;
  });

  const [compte] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")));
  return { mandatId, clos: ancien.libelle, jeton: compte ? null : await nouveauLien(userId, u.id), nom: existant?.nom ?? nom };
}
