/**
 * Import du bureau d'un mandat depuis un fichier CSV : une ligne par membre (nom, e-mail, rôle,
 * délégation, code de la délégation, designer). Lecture et contrôles de forme ; les contrôles qui
 * demandent la base (délégations, comptes, président) sont faits par `analyserImport` côté serveur.
 *
 * Module sans dépendance serveur : l'écran s'en sert pour le fichier modèle.
 */
import { lignesCsv, nettoyerCellule, simplifier } from "@/fonctionnalites/csv";
import { estRoleBureau, type Role } from "./roles";

export const MAX_LIGNES_IMPORT = 200;
export const TAILLE_MAX_IMPORT = 200 * 1024;

export class ErreurImport extends Error {}

/** Colonnes reconnues, avec les intitulés qu'on rencontre dans les fichiers. */
const COLONNES = {
  nom: ["nom", "nom_complet", "nom_et_prenoms", "nom_prenoms", "prenoms_et_nom", "membre"],
  email: ["email", "e_mail", "mail", "adresse_email", "adresse_e_mail", "courriel"],
  role: ["role", "poste"],
  delegation: ["delegation", "cellule", "commission"],
  code: ["code", "code_delegation", "code_de_la_delegation"],
  designer: ["designer", "graphiste"],
} as const;

type Colonne = keyof typeof COLONNES;

/** Rôles tels qu'on les écrit (sans accents ni majuscules), au masculin ou au féminin. */
const ROLES_ECRITS: Record<string, Role> = {
  president: "president",
  presidente: "president",
  vice_president: "vice_president",
  vice_presidente: "vice_president",
  vp: "vice_president",
  secretaire_general: "secretaire_general",
  secretaire_generale: "secretaire_general",
  sg: "secretaire_general",
  responsable: "responsable_delegation",
  responsable_de_delegation: "responsable_delegation",
  responsable_delegation: "responsable_delegation",
  responsable_de_la_delegation: "responsable_delegation",
  chef_de_delegation: "responsable_delegation",
  chef_de_cellule: "responsable_delegation",
  membre: "membre",
};

const OUI = ["oui", "o", "x", "1", "vrai", "yes"];
const NON = ["", "non", "n", "0", "faux", "no"];

export interface LigneImport {
  /** Numéro de la ligne dans le fichier (la ligne 1 est celle des intitulés). */
  ligne: number;
  nom: string;
  email: string;
  /** Rôle reconnu ; « Membre » si la cellule est vide. */
  role: Role | null;
  /** Délégation telle qu'écrite ; vide pour le bureau exécutif. */
  delegation: string;
  code: string;
  designer: boolean;
  erreurs: string[];
}

export function roleEcrit(texte: string): Role | null {
  const t = simplifier(texte);
  return t ? (ROLES_ECRITS[t] ?? null) : "membre";
}

/** Nom de délégation comparable : sans accents, casse ni espaces en trop. */
export function cleDelegation(nom: string): string {
  return simplifier(nom);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Membres d'un fichier CSV, chacun avec ses erreurs de forme ; une erreur sur le fichier lui-même est levée. */
export function lireImport(octets: Uint8Array): LigneImport[] {
  if (octets.length > TAILLE_MAX_IMPORT) throw new ErreurImport("Le fichier dépasse 200 Ko.");
  const [entete, ...lignes] = lignesCsv(octets);
  if (!entete) throw new ErreurImport("Le fichier est vide.");
  const colonnes = entete.map((e) => {
    const s = simplifier(e);
    return (Object.keys(COLONNES) as Colonne[]).find((c) => (COLONNES[c] as readonly string[]).includes(s)) ?? null;
  });
  for (const c of ["nom", "email"] as const)
    if (!colonnes.includes(c)) throw new ErreurImport(`Le fichier doit avoir une colonne « ${c} » (première ligne : les intitulés des colonnes).`);
  const doublon = colonnes.find((c, i) => c && colonnes.indexOf(c) !== i);
  if (doublon) throw new ErreurImport(`La colonne « ${doublon} » apparaît deux fois.`);
  if (!lignes.length) throw new ErreurImport("Le fichier n'a aucun membre sous la ligne des intitulés.");
  if (lignes.length > MAX_LIGNES_IMPORT) throw new ErreurImport(`${lignes.length} membres : un import en compte ${MAX_LIGNES_IMPORT} au plus.`);

  const vus = new Map<string, number>();
  return lignes.map((l, i) => {
    const v = (c: Colonne, max = 120) => {
      const j = colonnes.indexOf(c);
      return j < 0 ? "" : nettoyerCellule(l[j], max).replace(/\s+/g, " ");
    };
    const erreurs: string[] = [];
    const nom = v("nom", 100);
    const email = v("email").toLowerCase();
    const roleSaisi = v("role");
    const role = roleEcrit(roleSaisi);
    const delegation = role && estRoleBureau(role) ? "" : v("delegation", 81);
    const designerSaisi = simplifier(v("designer"));

    if (nom.length < 2) erreurs.push("Nom manquant.");
    if (!email) erreurs.push("E-mail manquant.");
    else if (!EMAIL.test(email)) erreurs.push(`E-mail invalide : « ${email} ».`);
    else if (vus.has(email)) erreurs.push(`E-mail déjà à la ligne ${vus.get(email)}.`);
    else vus.set(email, i + 2);
    if (!role) erreurs.push(`Rôle inconnu : « ${roleSaisi} » (Président, Vice-président, Secrétaire général, Responsable ou Membre).`);
    else if (!estRoleBureau(role) && !delegation) erreurs.push("Délégation manquante (seuls les rôles du bureau exécutif n'en ont pas).");
    if (!OUI.includes(designerSaisi) && !NON.includes(designerSaisi)) erreurs.push("Designer : « oui » ou vide.");

    return { ligne: i + 2, nom, email, role, delegation, code: delegation ? v("code", 10).toUpperCase() : "", designer: OUI.includes(designerSaisi), erreurs };
  });
}

export const MODELE_IMPORT = `nom;email;role;delegation;code;designer
Koné Aïcha;aicha.kone@esatic.edu.ci;Vice-présidente;;;
Traoré Moussa;moussa.traore@esatic.edu.ci;Responsable;Cellule communication;COM;oui
Bamba Fatou;fatou.bamba@esatic.edu.ci;Membre;Cellule communication;;
Diallo Ibrahim;ibrahim.diallo@esatic.edu.ci;Responsable;Délégation culturelle;CULT;
`;
