/**
 * Schéma de la base (Drizzle, Postgres).
 *
 * - Tables d'authentification : `user`, `session`, `account`, `verification`, au format attendu par
 *   Better Auth (noms anglais imposés par la bibliothèque).
 * - Organisation de l'association : section → délégations → mandats → affectations (un rôle par mandat),
 *   invitations (lien d'activation ou de réinitialisation remis par le bureau).
 *
 * - Génération : gabarits et leurs révisions publiées, photos téléversées, documents générés.
 *
 * Ce fichier n'importe que drizzle-orm (et des types, effacés à l'exécution) : il est lu tel quel par les scripts Node (migrations, création
 * du premier administrateur) comme par l'application.
 */
import type { Gabarit } from "@aeemci-studio/moteur";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const horodatage = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

// ── Authentification (Better Auth) ─────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** Administrateur de la plateforme (technique), indépendant des mandats. */
  estAdministrateur: boolean("est_administrateur").notNull().default(false),
  ...horodatage,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    ...horodatage,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...horodatage,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...horodatage,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ── Organisation de l'association ──────────────────────────────────────────────

export const section = pgTable("section", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Nom court affiché : « ESATIC ». */
  nom: text("nom").notNull().unique(),
  ...horodatage,
});

export const delegation = pgTable(
  "delegation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id").notNull().references(() => section.id),
    /** « Cellule communication », « Délégation culturelle »… Le bureau exécutif n'en est pas une : ses rôles sont sans délégation. */
    nom: text("nom").notNull(),
    /** Archivée : plus proposée pour les affectations, ses documents restent lisibles. */
    archivee: boolean("archivee").notNull().default(false),
    ...horodatage,
  },
  (t) => [uniqueIndex("delegation_section_nom_idx").on(t.sectionId, t.nom)],
);

export const statutMandat = pgEnum("statut_mandat", ["en_cours", "clos"]);

export const mandat = pgTable(
  "mandat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id").notNull().references(() => section.id),
    /** « 2025-2026 ». */
    libelle: text("libelle").notNull(),
    statut: statutMandat("statut").notNull().default("en_cours"),
    debut: timestamp("debut", { withTimezone: true }),
    fin: timestamp("fin", { withTimezone: true }),
    ...horodatage,
  },
  (t) => [uniqueIndex("mandat_section_libelle_idx").on(t.sectionId, t.libelle)],
);

export const role = pgEnum("role", ["president", "vice_president", "secretaire_general", "responsable_delegation", "membre"]);

/** Un membre occupe un rôle pendant un mandat, éventuellement au sein d'une délégation. */
export const affectation = pgTable(
  "affectation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mandatId: uuid("mandat_id").notNull().references(() => mandat.id),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    delegationId: uuid("delegation_id").references(() => delegation.id),
    role: role("role").notNull(),
    ...horodatage,
  },
  (t) => [index("affectation_user_idx").on(t.userId), uniqueIndex("affectation_mandat_user_idx").on(t.mandatId, t.userId)],
);

/**
 * Lien d'activation (premier mot de passe) ou de réinitialisation, remis par le bureau au membre.
 * Seule l'empreinte SHA-256 du jeton est gardée ; un lien sert une fois et expire.
 */
export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    empreinte: text("empreinte").notNull().unique(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    utiliseeLe: timestamp("utilisee_le", { withTimezone: true }),
    creeParId: text("cree_par_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitation_user_idx").on(t.userId)],
);

// ── Génération ─────────────────────────────────────────────────────────────────

/** Un gabarit tel que les membres le choisissent ; son contenu vit dans ses révisions. */
export const gabarit = pgTable("gabarit", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Identifiant stable, tiré du nom : une nouvelle publication du même nom crée une révision. */
  slug: text("slug").notNull().unique(),
  nom: text("nom").notNull(),
  description: text("description"),
  actif: boolean("actif").notNull().default(true),
  revisionCouranteId: uuid("revision_courante_id"),
  ...horodatage,
});

export const revisionGabarit = pgTable(
  "revision_gabarit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gabaritId: uuid("gabarit_id").notNull().references(() => gabarit.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    contenu: jsonb("contenu").$type<Gabarit>().notNull(),
    /** Préfixe des fichiers dans le stockage : les chemins `fond` et `couches` du contenu s'y ajoutent. */
    prefixe: text("prefixe").notNull(),
    /** Aperçu avec les valeurs d'exemple, pour la liste des gabarits. */
    vignette: text("vignette"),
    /** Révision indiquée par l'atelier dans `gabarit.publie.json`. */
    revisionAtelier: integer("revision_atelier"),
    importeParId: text("importe_par_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("revision_gabarit_numero_idx").on(t.gabaritId, t.numero)],
);

/** Photo envoyée depuis le formulaire, réutilisée par les aperçus puis par le document. */
export const televersement = pgTable(
  "televersement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    cle: text("cle").notNull(),
    type: text("type").notNull(),
    taille: integer("taille").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("televersement_user_idx").on(t.userId)],
);

/** Document généré : les valeurs saisies et la révision suffisent à le refaire, en haute définition par exemple. */
export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auteurId: text("auteur_id").notNull().references(() => user.id),
    revisionId: uuid("revision_id").notNull().references(() => revisionGabarit.id),
    titre: text("titre").notNull(),
    plan: text("plan").notNull(),
    /** Valeurs saisies ; une image y figure sous la forme `televersement:<id>`. */
    valeurs: jsonb("valeurs").$type<Record<string, string | number | null>>().notNull(),
    fichier: text("fichier").notNull(),
    type: text("type").notNull(),
    largeur: integer("largeur").notNull(),
    hauteur: integer("hauteur").notNull(),
    miniature: text("miniature").notNull(),
    /** Rattachement à la création : mandat et délégation de l'auteur (délégation vide : bureau exécutif ou administrateur). */
    mandatId: uuid("mandat_id").references(() => mandat.id),
    delegationId: uuid("delegation_id").references(() => delegation.id),
    ...horodatage,
  },
  (t) => [index("document_auteur_idx").on(t.auteurId, t.createdAt), index("document_delegation_idx").on(t.delegationId, t.createdAt)],
);
