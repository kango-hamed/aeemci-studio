/**
 * Identité de la section sur ses documents officiels : lignes de l'en-tête, pied de page et coordonnées.
 * Réglée par le bureau dans Organisation ; un champ laissé vide reprend la valeur par défaut.
 * Partagé par l'écran Organisation (navigateur) et la mise en page (serveur).
 */

export interface IdentiteSection {
  /** Nom court : « ESATIC ». */
  nom: string;
  /** Lignes entre « Association des Élèves… » et « Section … ». */
  entete: string[];
  /** Première ligne du pied de page. */
  rattachement: string;
  email: string | null;
  telephones: string | null;
}

/** Valeurs enregistrées (colonnes de `section`), `null` si non renseignées. */
export interface SaisieIdentite {
  entete: string | null;
  rattachement: string | null;
  email: string | null;
  telephones: string | null;
}

export const ENTETE_PAR_DEFAUT = ["Secrétariat Régional Abidjan Sud", "Sous-Comité de Treichville"];

export const rattachementParDefaut = (nom: string) => `Secrétariat Régional Abidjan Sud (SERAS / Sous-comité de Treichville / Section ${nom})`;

export const LIMITES_IDENTITE = { lignesEntete: 4, ligne: 90, rattachement: 160, email: 120, telephones: 120 } as const;

export function lignesEntete(texte: string | null): string[] {
  return (texte ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function identiteDe(nom: string, s: SaisieIdentite): IdentiteSection {
  const entete = lignesEntete(s.entete);
  return {
    nom,
    entete: entete.length ? entete : ENTETE_PAR_DEFAUT,
    rattachement: s.rattachement?.trim() || rattachementParDefaut(nom),
    email: s.email?.trim() || null,
    telephones: s.telephones?.trim() || null,
  };
}
