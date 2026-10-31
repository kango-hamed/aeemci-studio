/**
 * Schéma de la base (Drizzle, Postgres).
 *
 * - Tables d'authentification : `user`, `session`, `account`, `verification`, au format attendu par
 *   Better Auth (noms anglais imposés par la bibliothèque).
 * - Organisation de l'association : section → délégations → mandats → affectations (un rôle par mandat),
 *   invitations (lien d'activation ou de réinitialisation remis par le bureau).
 *
 * - Génération : gabarits et leurs révisions publiées, photos téléversées, documents générés.
 * - Documents administratifs : rédaction, circuit de validation, numérotation, signatures et cachet.
 * - Activités (fiche, bilan, documents et photos rattachés) et notes de passation, par mandat.
 *
 * Ce fichier n'importe que drizzle-orm (et des types, effacés à l'exécution) : il est lu tel quel par les scripts Node (migrations, création
 * du premier administrateur) comme par l'application.
 */
import type { Gabarit } from "@aeemci-studio/moteur";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
  /** Image du cachet de la section (stockage privé), apposée à la validation des documents administratifs. */
  cachet: text("cachet"),
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
    /** Code court du numéro des documents administratifs (« COM ») ; le bureau exécutif a « BE ». */
    code: text("code"),
    ...horodatage,
  },
  (t) => [uniqueIndex("delegation_section_nom_idx").on(t.sectionId, t.nom), uniqueIndex("delegation_section_code_idx").on(t.sectionId, t.code)],
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
    /** Intérim activé par le président : le vice-président valide et signe à sa place. */
    interim: boolean("interim").notNull().default(false),
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
    /** Designer (cellule communication) : importe, règle et publie les gabarits, quel que soit son rôle. */
    designer: boolean("designer").notNull().default(false),
    ...horodatage,
  },
  (t) => [index("affectation_user_idx").on(t.userId), uniqueIndex("affectation_mandat_user_idx").on(t.mandatId, t.userId)],
);

/** Image de signature d'un membre (stockage privé), apposée sur les documents qu'il signe. */
export const signature = pgTable("signature", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  cle: text("cle").notNull(),
  ...horodatage,
});

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
    /** Attribué à la publication ; un brouillon n'en a pas. */
    numero: integer("numero"),
    contenu: jsonb("contenu").$type<Gabarit>().notNull(),
    /** Préfixe des fichiers dans le stockage : les chemins `fond` et `couches` du contenu s'y ajoutent. */
    prefixe: text("prefixe").notNull(),
    /** Aperçu avec les valeurs d'exemple, pour la liste des gabarits. */
    vignette: text("vignette"),
    /** Révision indiquée par l'atelier dans `gabarit.publie.json`. */
    revisionAtelier: integer("revision_atelier"),
    importeParId: text("importe_par_id").references(() => user.id, { onDelete: "set null" }),
    /** Vide : brouillon (réglages en cours, invisible des membres). Un gabarit a au plus un brouillon. */
    publieeLe: timestamp("publiee_le", { withTimezone: true }),
    publieeParId: text("publiee_par_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("revision_gabarit_numero_idx").on(t.gabaritId, t.numero)],
);

/** Gabarit réservé à certaines délégations ; sans ligne, il sert à toute la section. */
export const gabaritDelegation = pgTable(
  "gabarit_delegation",
  {
    gabaritId: uuid("gabarit_id").notNull().references(() => gabarit.id, { onDelete: "cascade" }),
    delegationId: uuid("delegation_id").notNull().references(() => delegation.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.gabaritId, t.delegationId] })],
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

export const origineDocument = pgEnum("origine_document", ["genere", "depose", "redige"]);
/** Types de documents administratifs ; le code entre dans le numéro (AEEMCI-ESATIC/COM/LET/2026/014). */
export const typeAdministratif = pgEnum("type_administratif", ["LET", "PV", "CONV", "COM", "ATT", "OM"]);
/** Circuit de validation d'un document administratif. */
export const etatValidation = pgEnum("etat_validation", ["redaction", "soumis", "a_corriger", "valide"]);

/** Signataire apposé sur un document validé (instantané : le nom et le rôle au moment de la validation). */
export interface Signataire {
  role: "secretaire_seance" | "president" | "interim";
  userId: string;
  nom: string;
}
/** Brouillon : visible par l'auteur et le bureau exécutif seulement. Publié : selon la visibilité. */
export const statutDocument = pgEnum("statut_document", ["brouillon", "publie"]);
/** Qui lit un document publié, en plus de l'auteur et du bureau : sa délégation, ou toute la section. */
export const visibiliteDocument = pgEnum("visibilite_document", ["bureau", "delegation", "section"]);

/** Fichier d'une déclinaison supplémentaire (story à côté du post…), fait avec le même formulaire. */
export interface Declinaison {
  plan: string;
  fichier: string;
  type: string;
  largeur: number;
  hauteur: number;
}

/**
 * Document de la plateforme : généré depuis un gabarit (les valeurs saisies et la révision suffisent à le
 * refaire, en haute définition par exemple) ou déposé tel quel (PDF, image, scan).
 */
export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auteurId: text("auteur_id").notNull().references(() => user.id),
    origine: origineDocument("origine").notNull().default("genere"),
    statut: statutDocument("statut").notNull().default("publie"),
    visibilite: visibiliteDocument("visibilite").notNull().default("delegation"),
    /** Document généré seulement. */
    revisionId: uuid("revision_id").references(() => revisionGabarit.id),
    titre: text("titre").notNull(),
    /** Déclinaison principale (document généré seulement). */
    plan: text("plan"),
    /** Valeurs saisies ; une image y figure sous la forme `televersement:<id>`. Vide pour un dépôt. */
    valeurs: jsonb("valeurs").$type<Record<string, string | number | null>>().notNull().default({}),
    /** Autres déclinaisons produites avec le même formulaire. */
    declinaisons: jsonb("declinaisons").$type<Declinaison[]>().notNull().default([]),
    fichier: text("fichier").notNull(),
    type: text("type").notNull(),
    /** Nom du fichier déposé, pour le téléchargement. */
    nomFichier: text("nom_fichier"),
    taille: integer("taille"),
    /** Dimensions en pixels d'une image ; vides pour un PDF. */
    largeur: integer("largeur"),
    hauteur: integer("hauteur"),
    /** Miniature JPEG ; vide pour un PDF déposé (icône à la place). */
    miniature: text("miniature"),
    /** Document administratif rédigé dans la plateforme : type, champs saisis, validation. */
    typeAdministratif: typeAdministratif("type_administratif"),
    contenu: jsonb("contenu").$type<Record<string, string>>(),
    etatValidation: etatValidation("etat_validation"),
    /** Attribué à la validation, sans trou dans la séquence. */
    numero: text("numero").unique(),
    valideLe: timestamp("valide_le", { withTimezone: true }),
    valideParId: text("valide_par_id").references(() => user.id),
    signataires: jsonb("signataires").$type<Signataire[]>(),
    /** Version précédente : un document validé est figé, sa correction crée une nouvelle version. */
    versionDeId: uuid("version_de_id"),
    /** Rattachement à la création : mandat et délégation de l'auteur (délégation vide : bureau exécutif ou administrateur). */
    mandatId: uuid("mandat_id").references(() => mandat.id),
    delegationId: uuid("delegation_id").references(() => delegation.id),
    /** Activité à laquelle le document se rattache (affiche, PV, photos…). */
    activiteId: uuid("activite_id").references(() => activite.id, { onDelete: "set null" }),
    ...horodatage,
  },
  (t) => [
    index("document_auteur_idx").on(t.auteurId, t.createdAt),
    index("document_delegation_idx").on(t.delegationId, t.createdAt),
    index("document_activite_idx").on(t.activiteId),
    index("document_mandat_idx").on(t.mandatId),
  ],
);

/** Dernier numéro attribué, par section, code de délégation, type et année civile. */
export const compteur = pgTable(
  "compteur",
  {
    sectionId: uuid("section_id").notNull().references(() => section.id),
    delegation: text("delegation").notNull(),
    type: typeAdministratif("type").notNull(),
    annee: integer("annee").notNull(),
    dernier: integer("dernier").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sectionId, t.delegation, t.type, t.annee] })],
);

export const actionValidation = pgEnum("action_validation", ["soumis", "correction_demandee", "valide", "nouvelle_version"]);

/** Historique du circuit de validation d'un document : qui, quoi, quand, avec quel commentaire. */
export const evenementValidation = pgTable(
  "evenement_validation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => document.id, { onDelete: "cascade" }),
    acteurId: text("acteur_id").references(() => user.id, { onDelete: "set null" }),
    action: actionValidation("action").notNull(),
    commentaire: text("commentaire"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evenement_validation_document_idx").on(t.documentId, t.createdAt)],
);

// ── Activités et passation ─────────────────────────────────────────────────────

/**
 * Une activité de la section (conférence, sortie, journée d'intégration…), rattachée au mandat et à la
 * délégation qui l'organise (aucune : le bureau exécutif). Se lit selon sa visibilité, comme un document publié.
 */
export const activite = pgTable(
  "activite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mandatId: uuid("mandat_id").notNull().references(() => mandat.id),
    delegationId: uuid("delegation_id").references(() => delegation.id),
    auteurId: text("auteur_id").notNull().references(() => user.id),
    titre: text("titre").notNull(),
    /** Jour de l'activité (« 2026-11-14 ») et heure facultative (« 15:00 »). */
    date: text("date").notNull(),
    heure: text("heure"),
    lieu: text("lieu"),
    description: text("description"),
    /** Bilan rédigé après l'activité : déroulement, participation, ce qu'il faut retenir. */
    bilan: text("bilan"),
    visibilite: visibiliteDocument("visibilite").notNull().default("section"),
    ...horodatage,
  },
  (t) => [index("activite_mandat_idx").on(t.mandatId, t.date), index("activite_delegation_idx").on(t.delegationId, t.date)],
);

/** Points en suspens laissés au mandat suivant, par délégation (`cle` : identifiant de la délégation, ou « bureau »). */
export const notePassation = pgTable(
  "note_passation",
  {
    mandatId: uuid("mandat_id").notNull().references(() => mandat.id),
    cle: text("cle").notNull(),
    texte: text("texte").notNull(),
    auteurId: text("auteur_id").references(() => user.id, { onDelete: "set null" }),
    ...horodatage,
  },
  (t) => [primaryKey({ columns: [t.mandatId, t.cle] })],
);
