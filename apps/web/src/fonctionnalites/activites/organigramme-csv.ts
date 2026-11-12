/**
 * Lecture du fichier CSV d'un organigramme : une ligne par personne (commission, rôle, nom, téléphone).
 * Sert aux commissions d'une activité comme aux équipes du mandat. Module sans dépendance serveur :
 * l'écran s'en sert pour le fichier modèle.
 */
import { lignesCsv, nettoyerCellule, simplifier } from "@/fonctionnalites/csv";
import { numeroPropre } from "@/fonctionnalites/organisation/telephone";

export type RoleEquipe = "responsable" | "adjoint" | "membre";

export const LIBELLES_ROLES_EQUIPE: Record<RoleEquipe, string> = { responsable: "Responsable", adjoint: "Adjoint", membre: "Membre" };

export const MAX_LIGNES_ORGANIGRAMME = 300;
export const TAILLE_MAX_ORGANIGRAMME = 200 * 1024;

export class ErreurOrganigramme extends Error {}

const COLONNES = {
  commission: ["commission", "equipe", "cellule", "pole", "groupe", "sous_commission"],
  role: ["role", "poste", "fonction"],
  nom: ["nom", "nom_complet", "nom_et_prenoms", "nom_prenoms", "prenoms_et_nom", "membre"],
  telephone: ["telephone", "tel", "numero", "numero_de_telephone", "contact", "contacts", "whatsapp", "numero_whatsapp", "portable", "mobile"],
} as const;

type Colonne = keyof typeof COLONNES;

const ROLES_ECRITS: Record<string, RoleEquipe> = {
  responsable: "responsable",
  chef: "responsable",
  cheffe: "responsable",
  chef_de_commission: "responsable",
  president: "responsable",
  presidente: "responsable",
  coordinateur: "responsable",
  coordinatrice: "responsable",
  adjoint: "adjoint",
  adjointe: "adjoint",
  responsable_adjoint: "adjoint",
  responsable_adjointe: "adjoint",
  sous_responsable: "adjoint",
  vice: "adjoint",
  vice_president: "adjoint",
  vice_presidente: "adjoint",
  membre: "membre",
};

/** Rôle écrit dans le fichier ; une cellule vide vaut « membre ». `null` : rôle inconnu. */
export function roleEquipeEcrit(texte: string): RoleEquipe | null {
  const t = simplifier(texte);
  return t ? (ROLES_ECRITS[t] ?? null) : "membre";
}

export interface LigneOrganigramme {
  ligne: number;
  commission: string;
  role: RoleEquipe | null;
  nom: string;
  /** Chiffres seuls, indicatif compris ; vide si absent. */
  telephone: string;
  erreurs: string[];
}

/** Personnes d'un fichier CSV, chacune avec ses erreurs ; une erreur sur le fichier lui-même est levée. */
export function lireOrganigramme(octets: Uint8Array): LigneOrganigramme[] {
  if (octets.length > TAILLE_MAX_ORGANIGRAMME) throw new ErreurOrganigramme("Le fichier dépasse 200 Ko.");
  const [entete, ...lignes] = lignesCsv(octets);
  if (!entete) throw new ErreurOrganigramme("Le fichier est vide.");
  const colonnes = entete.map((e) => {
    const s = simplifier(e);
    return (Object.keys(COLONNES) as Colonne[]).find((c) => (COLONNES[c] as readonly string[]).includes(s)) ?? null;
  });
  const absente = (["commission", "nom"] as const).find((c) => !colonnes.includes(c));
  if (absente) throw new ErreurOrganigramme(`Le fichier doit avoir une colonne « ${absente} » (première ligne : les intitulés des colonnes).`);
  const doublon = colonnes.find((c, i) => c && colonnes.indexOf(c) !== i);
  if (doublon) throw new ErreurOrganigramme(`La colonne « ${doublon} » apparaît deux fois.`);
  if (!lignes.length) throw new ErreurOrganigramme("Le fichier n'a personne sous la ligne des intitulés.");
  if (lignes.length > MAX_LIGNES_ORGANIGRAMME) throw new ErreurOrganigramme(`${lignes.length} lignes : un import en compte ${MAX_LIGNES_ORGANIGRAMME} au plus.`);

  // Un seul responsable et un seul adjoint par commission : la première ligne qui le porte.
  const chefs = new Map<string, number>();
  return lignes.map((l, i) => {
    const v = (c: Colonne, max: number) => {
      const j = colonnes.indexOf(c);
      return j < 0 ? "" : nettoyerCellule(l[j], max).replace(/\s+/g, " ");
    };
    const erreurs: string[] = [];
    const commission = v("commission", 80);
    const nom = v("nom", 100);
    const roleSaisi = v("role", 60);
    const role = roleEquipeEcrit(roleSaisi);
    const telephoneSaisi = v("telephone", 40);
    const telephone = telephoneSaisi ? numeroPropre(telephoneSaisi) : "";

    if (!commission) erreurs.push("Commission manquante.");
    if (nom.length < 2) erreurs.push("Nom manquant.");
    if (telephone === null) erreurs.push(`Numéro invalide : « ${telephoneSaisi} » (dix chiffres, ou l'indicatif précédé de +).`);
    if (!role) erreurs.push(`Rôle inconnu : « ${roleSaisi} » (Responsable, Adjoint ou Membre).`);
    else if (role !== "membre" && commission) {
      const cle = `${simplifier(commission)}|${role}`;
      if (chefs.has(cle)) erreurs.push(`${LIBELLES_ROLES_EQUIPE[role]} déjà donné à la ligne ${chefs.get(cle)} pour cette commission.`);
      else chefs.set(cle, i + 2);
    }
    return { ligne: i + 2, commission, role, nom, telephone: telephone ?? "", erreurs };
  });
}

/** Commissions du fichier, dans l'ordre d'apparition, avec leurs personnes (fichier sans erreur). */
export function regrouperParCommission(lignes: LigneOrganigramme[]): { nom: string; membres: { role: RoleEquipe; nom: string; telephone: string | null }[] }[] {
  const groupes = new Map<string, { nom: string; membres: { role: RoleEquipe; nom: string; telephone: string | null }[] }>();
  for (const l of lignes) {
    const cle = simplifier(l.commission);
    if (!groupes.has(cle)) groupes.set(cle, { nom: l.commission, membres: [] });
    groupes.get(cle)!.membres.push({ role: l.role ?? "membre", nom: l.nom, telephone: l.telephone || null });
  }
  return [...groupes.values()];
}

export const MODELE_ORGANIGRAMME = `commission;role;nom;telephone
Logistique;Responsable;Koné Aïcha;0700000001
Logistique;Adjoint;Traoré Moussa;0500000002
Logistique;Membre;Bamba Fatou;0100000003
Accueil;Responsable;Diallo Ibrahim;0700000004
Accueil;Membre;Ouattara Mariam;
`;
