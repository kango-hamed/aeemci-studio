/**
 * Organisation contre Postgres : comptes créés par le bureau, liens d'activation, règles sur les rôles,
 * délégations et lecture des documents par délégation. Base jetable dans TEST_DATABASE_URL.
 */
import pg from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import { migrer } from "../scripts/migrer.ts";
import { creerAdmin } from "../scripts/creer-admin.ts";
import type { Acteur } from "@/fonctionnalites/organisation/droits";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("organisation (Postgres)", () => {
  let m: {
    gestion: typeof import("@/fonctionnalites/organisation/gestion");
    invitations: typeof import("@/fonctionnalites/organisation/invitations");
    requetes: typeof import("@/fonctionnalites/organisation/requetes");
    docs: typeof import("@/fonctionnalites/documents/requetes");
    auth: typeof import("@/serveur/auth").auth;
  };
  let president: Acteur;
  let mandatId: string;
  let communication: string;
  let culture: string;

  /** Acteur tel que la session le construit : rôle lu dans le mandat en cours. */
  async function acteur(userId: string, estAdministrateur = false): Promise<Acteur> {
    const a = await m.requetes.affectationCourante(userId);
    return { id: userId, estAdministrateur, affectation: a && { role: a.role, delegationId: a.delegationId } };
  }

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await c.end();
    await migrer(url!);
    const { userId } = await creerAdmin(url!, { email: "president@esatic.edu.ci", nom: "Awa Koné", motDePasse: "mot-de-passe-solide", role: "president", mandat: "2026-2027" });
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET = "secret-de-test-secret-de-test-secret";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    m = {
      gestion: await import("@/fonctionnalites/organisation/gestion"),
      invitations: await import("@/fonctionnalites/organisation/invitations"),
      requetes: await import("@/fonctionnalites/organisation/requetes"),
      docs: await import("@/fonctionnalites/documents/requetes"),
      auth: (await import("@/serveur/auth")).auth,
    };
    // Le compte créé par le script est administrateur ; on teste ici le président « ordinaire ».
    president = await acteur(userId);
    mandatId = (await m.requetes.mandatCourant())!.id;
  });

  it("le bureau crée et nomme les délégations ; les doublons sont refusés", async () => {
    communication = await m.gestion.creerDelegation(president, "Cellule  communication ");
    culture = await m.gestion.creerDelegation(president, "Délégation culturelle");
    await expect(m.gestion.creerDelegation(president, "Cellule communication")).rejects.toThrow(/déjà ce nom/);
    await m.gestion.renommerDelegation(president, culture, "Délégation culture");
    const noms = (await m.requetes.delegationsDe((await m.requetes.mandatCourant())!.sectionId, mandatId)).map((d) => d.nom);
    expect(noms).toEqual(["Cellule communication", "Délégation culture"]);
  });

  it("ajoute un membre ; son lien active le compte une seule fois, puis il se connecte", async () => {
    const r = await m.gestion.ajouterMembre(president, { nom: "Moussa Traoré", email: "Moussa@Esatic.edu.ci", role: "membre", delegationId: communication });
    expect(r.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(m.auth.api.signInEmail({ body: { email: "moussa@esatic.edu.ci", password: "son-mot-de-passe" } })).rejects.toBeTruthy();

    const lien = await m.invitations.lienValide(r.jeton!);
    expect(lien).toMatchObject({ nom: "Moussa Traoré", email: "moussa@esatic.edu.ci", reinitialisation: false });
    expect(await m.invitations.utiliserLien(r.jeton!, "son-mot-de-passe")).toBe("moussa@esatic.edu.ci");
    expect(await m.invitations.utiliserLien(r.jeton!, "autre-mot-de-passe")).toBeNull();
    expect(await m.invitations.lienValide(r.jeton!)).toBeNull();

    const s = await m.auth.api.signInEmail({ body: { email: "moussa@esatic.edu.ci", password: "son-mot-de-passe" } });
    expect(s.user.id).toBe(r.userId);
    const membres = await m.requetes.membresDuMandat(mandatId);
    expect(membres.find((x) => x.userId === r.userId)).toMatchObject({ role: "membre", delegation: "Cellule communication", compte: "actif" });
  });

  it("un lien de réinitialisation remplace le mot de passe et ferme les sessions ouvertes", async () => {
    const moussa = (await m.requetes.membresDuMandat(mandatId)).find((x) => x.email === "moussa@esatic.edu.ci")!;
    const jeton = await m.gestion.lienPourMembre(president, moussa.userId);
    expect((await m.invitations.lienValide(jeton))?.reinitialisation).toBe(true);
    // Un nouveau lien annule le précédent.
    const jeton2 = await m.gestion.lienPourMembre(president, moussa.userId);
    expect(await m.invitations.lienValide(jeton)).toBeNull();
    await m.invitations.utiliserLien(jeton2, "nouveau-mot-de-passe");
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    const { rows } = await c.query("select count(*)::int n from session where user_id = $1", [moussa.userId]);
    await c.end();
    expect(rows[0].n).toBe(0);
    await expect(m.auth.api.signInEmail({ body: { email: "moussa@esatic.edu.ci", password: "son-mot-de-passe" } })).rejects.toBeTruthy();
    await m.auth.api.signInEmail({ body: { email: "moussa@esatic.edu.ci", password: "nouveau-mot-de-passe" } });
  });

  it("vérifie les postes : délégation obligatoire hors bureau, un seul président, rôle du président protégé", async () => {
    await expect(m.gestion.ajouterMembre(president, { nom: "Sans Délégation", email: "sd@esatic.edu.ci", role: "membre" })).rejects.toThrow(/délégation/);
    await expect(m.gestion.ajouterMembre(president, { nom: "Second Président", email: "p2@esatic.edu.ci", role: "president" })).rejects.toThrow(/déjà un président/);
    await expect(m.gestion.ajouterMembre(president, { nom: "Moussa", email: "moussa@esatic.edu.ci", role: "membre", delegationId: culture })).rejects.toThrow(/déjà dans le mandat/);

    const sg = await m.gestion.ajouterMembre(president, { nom: "Fatou Bamba", email: "sg@esatic.edu.ci", role: "secretaire_general", delegationId: culture });
    const membres = await m.requetes.membresDuMandat(mandatId);
    expect(membres.find((x) => x.userId === sg.userId)).toMatchObject({ role: "secretaire_general", delegationId: null });

    const secretaire = await acteur(sg.userId);
    const affPresident = membres.find((x) => x.role === "president")!.affectationId;
    await expect(m.gestion.retirerDuMandat(secretaire, affPresident)).rejects.toThrow(/président/);
    await expect(m.gestion.lienPourMembre(secretaire, president.id)).rejects.toThrow(/administrateur|président/);
    await expect(m.gestion.modifierPoste(secretaire, membres.find((x) => x.userId === sg.userId)!.affectationId, { role: "membre", delegationId: culture })).rejects.toThrow(/propre rôle/);

    const moussa = await acteur(membres.find((x) => x.email === "moussa@esatic.edu.ci")!.userId);
    await expect(m.gestion.creerDelegation(moussa, "Pirate")).rejects.toThrow(/bureau/);
  });

  it("archive une délégation seulement sans membre ; une délégation archivée n'est plus proposée", async () => {
    await expect(m.gestion.archiverDelegation(president, communication, true)).rejects.toThrow(/Réaffecte/);
    const parNom = Object.fromEntries((await m.requetes.delegationsDe((await m.requetes.mandatCourant())!.sectionId, mandatId)).map((d) => [d.nom, d.membres]));
    expect(parNom).toEqual({ "Cellule communication": 1, "Délégation culture": 0 });
    await m.gestion.archiverDelegation(president, culture, true);
    await expect(m.gestion.ajouterMembre(president, { nom: "Awa", email: "awa@esatic.edu.ci", role: "membre", delegationId: culture })).rejects.toThrow(/archivée/);
    await m.gestion.archiverDelegation(president, culture, false);
  });

  it("retiré du mandat, un membre garde son compte mais perd son rôle", async () => {
    const r = await m.gestion.ajouterMembre(president, { nom: "Ibrahim Coulibaly", email: "ibrahim@esatic.edu.ci", role: "membre", delegationId: culture });
    const aff = (await m.requetes.membresDuMandat(mandatId)).find((x) => x.userId === r.userId)!;
    await m.gestion.retirerDuMandat(president, aff.affectationId);
    expect(await m.requetes.affectationCourante(r.userId)).toBeNull();
    expect((await m.requetes.anciensMembres(mandatId)).map((a) => a.email)).toContain("ibrahim@esatic.edu.ci");
    // Réaffecté avec la même adresse : même compte, nouveau lien car jamais activé.
    const retour = await m.gestion.ajouterMembre(president, { nom: "Ibrahim Coulibaly", email: "ibrahim@esatic.edu.ci", role: "responsable_delegation", delegationId: culture });
    expect(retour.userId).toBe(r.userId);
    expect(retour.jeton).toBeTruthy();
  });

  it("lecture des documents : sa délégation, pas celle des autres ; le bureau voit tout", async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    const membres = await m.requetes.membresDuMandat(mandatId);
    const moussa = membres.find((x) => x.email === "moussa@esatic.edu.ci")!;
    const ibrahim = membres.find((x) => x.email === "ibrahim@esatic.edu.ci")!;
    const { rows } = await c.query(
      `with g as (insert into gabarit (slug, nom) values ('essai', 'Essai') returning id),
            r as (insert into revision_gabarit (gabarit_id, numero, contenu, prefixe) select id, 1, '{}'::jsonb, 'p' from g returning id)
       insert into document (auteur_id, revision_id, titre, plan, valeurs, fichier, type, largeur, hauteur, miniature, mandat_id, delegation_id)
       select $1, r.id, 'Affiche com', 'post', '{}'::jsonb, 'f', 'image/png', 1080, 1350, 'm', $2, $3 from r returning id`,
      [moussa.userId, mandatId, communication],
    );
    await c.end();
    const doc = rows[0].id as string;

    expect(await m.docs.documentLisible(doc, await acteur(moussa.userId))).not.toBeNull();
    expect(await m.docs.documentLisible(doc, await acteur(ibrahim.userId))).toBeNull();
    expect(await m.docs.documentLisible(doc, president)).not.toBeNull();
    expect((await m.docs.documentsPartages(await acteur(ibrahim.userId)))!.map((d) => d.titre)).toEqual([]);
    expect((await m.docs.documentsPartages(president))!.map((d) => [d.titre, d.auteur])).toEqual([["Affiche com", "Moussa Traoré"]]);
  });
});
