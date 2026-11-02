/**
 * Création par lot (comme les jeux de données de Photoshop ou Illustrator) : un fichier CSV avec une
 * ligne par document et une colonne par champ du gabarit, plus les photos nommées dans le fichier.
 *
 * Familles de colonnes :
 * - texte : la cellule telle quelle (retours à la ligne permis entre guillemets) ;
 * - calculée : date, nombre, jauge, écrits comme dans Excel puis mis en forme par le gabarit
 *   (format de date, milliers, remplissage de la jauge, texte fixe autour) ;
 * - image : le nom du fichier photo, choisi avec le CSV ;
 * - autre : le titre du document, et les colonnes inconnues, ignorées.
 *
 * Module sans dépendance serveur : l'écran lit le fichier, le serveur revalide chaque ligne.
 */

import { lignesCsv, nettoyerCellule, simplifier } from "@/fonctionnalites/csv";

export type TypeChampLot = "texte" | "date" | "nombre" | "image" | "jauge";
export type Famille = "texte" | "calculee" | "image" | "autre";

export interface ChampLot {
  nom: string;
  type: TypeChampLot;
  libelle: string;
  obligatoire: boolean;
}

export interface ColonneLot {
  entete: string;
  /** Champ du gabarit, « titre » (titre du document) ou null (colonne ignorée). */
  cible: string | null;
  famille: Famille;
}

export interface LigneLot {
  /** Numéro de ligne dans le fichier (2 = première ligne sous les intitulés). */
  ligne: number;
  titre: string;
  /** Valeurs des champs texte et calculés, prêtes pour le moteur (dates en AAAA-MM-JJ). */
  valeurs: Record<string, string>;
  /** Champ image → nom du fichier écrit dans la cellule. */
  images: Record<string, string>;
}

export interface Lot {
  colonnes: ColonneLot[];
  lignes: LigneLot[];
}

export const MAX_LIGNES_LOT = 50;
export const TAILLE_MAX_CSV_LOT = 500 * 1024;
const LONGUEUR_MAX = 2000;

export class ErreurLot extends Error {}

export function familleDe(type: TypeChampLot): Famille {
  return type === "texte" ? "texte" : type === "image" ? "image" : "calculee";
}

export const LIBELLES_FAMILLES: Record<Famille, string> = { texte: "Texte", calculee: "Calculé", image: "Image", autre: "Autre" };

const COLONNES_TITRE = ["titre_du_document", "titre_document", "nom_du_document", "titre"];

/** Colonne → champ, par son nom technique ou par son libellé ; « titre » seulement si aucun champ ne s'appelle ainsi. */
export function associerColonnes(entetes: string[], champs: ChampLot[]): ColonneLot[] {
  return entetes.map((entete) => {
    const cle = simplifier(entete);
    const champ = cle ? champs.find((c) => simplifier(c.nom) === cle || simplifier(c.libelle) === cle) : undefined;
    if (champ) return { entete, cible: champ.nom, famille: familleDe(champ.type) };
    if (COLONNES_TITRE.includes(cle)) return { entete, cible: "titre", famille: "autre" };
    return { entete, cible: null, famille: "autre" };
  });
}

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

function iso(a: number, m: number, j: number): string | null {
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Date telle qu'on l'écrit dans Excel → AAAA-MM-JJ : « 15/11/2026 », « 15-11-26 », « 2026-11-15 »,
 * « samedi 15 novembre 2026 », ou le numéro de série d'Excel (46341). Illisible : rendue telle quelle
 * (le contrôle du serveur la signale).
 */
export function dateIso(texte: string): string {
  const t = texte.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(t);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!) ?? t;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (m) return iso(m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!, +m[2]!, +m[1]!) ?? t;
  m = /^(?:[a-z]+\s+)?(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})$/.exec(simplifier(t).replace(/_/g, " "));
  if (m && MOIS.includes(m[2]!)) return iso(+m[3]!, MOIS.indexOf(m[2]!) + 1, +m[1]!) ?? t;
  if (/^\d{5}$/.test(t) && +t > 30000 && +t < 80000) return new Date(Date.UTC(1899, 11, 30) + +t * 86400000).toISOString().slice(0, 10);
  return t;
}

/** Valeur d'une cellule pour le moteur, selon le type du champ. */
export function valeurDeCellule(type: TypeChampLot, cellule: string): string {
  if (type === "date") return cellule ? dateIso(cellule) : "";
  if (type === "jauge") return cellule.replace(/\s*%$/, "");
  return cellule;
}

/** Nom de fichier ramené à sa base, sans dossier, extension, accents ni casse : « Photos\Awa Koné.JPG » → « awa_kone ». */
export function cleFichier(nom: string): string {
  return simplifier((nom.split(/[\\/]/).pop() ?? "").replace(/\.(jpe?g|png|webp|heic)$/i, ""));
}

/** Lit le fichier CSV du lot. Les erreurs de forme (intitulés, taille) arrêtent la lecture ; celles des valeurs sont contrôlées ligne par ligne ensuite. */
export function lireLot(octets: Uint8Array, champs: ChampLot[]): Lot {
  if (octets.length > TAILLE_MAX_CSV_LOT) throw new ErreurLot("Le fichier dépasse 500 Ko.");
  const [entete, ...lignes] = lignesCsv(octets);
  if (!entete) throw new ErreurLot("Le fichier est vide.");
  const colonnes = associerColonnes(entete, champs);
  const doublon = colonnes.find((c, i) => c.cible && colonnes.findIndex((x) => x.cible === c.cible) !== i);
  if (doublon) throw new ErreurLot(`Deux colonnes remplissent « ${doublon.cible === "titre" ? "titre" : champs.find((c) => c.nom === doublon.cible)!.libelle} ».`);
  const manquantes = champs.filter((c) => c.obligatoire && !colonnes.some((x) => x.cible === c.nom));
  if (manquantes.length)
    throw new ErreurLot(`Colonne${manquantes.length > 1 ? "s" : ""} manquante${manquantes.length > 1 ? "s" : ""} : ${manquantes.map((c) => `« ${c.libelle} »`).join(", ")}. Pars du fichier modèle du gabarit.`);
  if (!lignes.length) throw new ErreurLot("Le fichier n'a aucune ligne sous celle des intitulés.");
  if (lignes.length > MAX_LIGNES_LOT) throw new ErreurLot(`${lignes.length} lignes : un lot en compte ${MAX_LIGNES_LOT} au plus. Partage le fichier en plusieurs lots.`);

  return {
    colonnes,
    lignes: lignes.map((cellules, i) => {
      const l: LigneLot = { ligne: i + 2, titre: "", valeurs: {}, images: {} };
      colonnes.forEach((col, j) => {
        if (!col.cible) return;
        const v = nettoyerCellule(cellules[j], LONGUEUR_MAX);
        if (col.cible === "titre") l.titre = v.replace(/\s+/g, " ").slice(0, 200);
        else {
          const champ = champs.find((c) => c.nom === col.cible)!;
          if (champ.type === "image") {
            if (v) l.images[champ.nom] = v;
          } else if (v) l.valeurs[champ.nom] = valeurDeCellule(champ.type, v);
        }
      });
      return l;
    }),
  };
}

/** Une cellule CSV : entre guillemets si besoin. */
const cellule = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Fichier modèle d'un gabarit : les libellés en intitulés, puis deux lignes d'exemple
 * (valeurs du designer, dates à la française, photos `photo-1.jpg`…).
 */
export function modeleLot(champs: ChampLot[], exemples: Record<string, string>): string {
  const entetes = [...champs.map((c) => c.libelle), "Titre du document"];
  const exemple = (n: number) =>
    [
      ...champs.map((c) => {
        if (c.type === "image") return `photo-${n}.jpg`;
        const e = exemples[c.nom] ?? "";
        if (c.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(e)) return e.split("-").reverse().join("/");
        return e;
      }),
      "",
    ]
      .map(cellule)
      .join(";");
  return `${entetes.map(cellule).join(";")}\n${exemple(1)}\n${exemple(2)}\n`;
}
