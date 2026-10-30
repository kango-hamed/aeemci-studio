import "server-only";
import { and, eq } from "drizzle-orm";
import { PHOTO_ESSAI, valeursEssai, type Gabarit, type Valeurs } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { cheminDeTeleversement } from "./rendu";

/** Valeurs envoyées par le formulaire : texte, nombre, ou `televersement:<id>` pour une image. */
export type ValeursSaisies = Record<string, string | number | null>;

export const PREFIXE_TELEVERSEMENT = "televersement:";
const LONGUEUR_MAX = 2000;

export interface ValeursPreparees {
  /** Pour le moteur : images en chemins locaux. */
  moteur: Valeurs;
  /** Pour la base : seulement les champs du gabarit, images en `televersement:<id>`. */
  stockees: ValeursSaisies;
}

/**
 * Ne garde que les champs du gabarit et remplace chaque photo par son fichier local, après avoir
 * vérifié qu'elle appartient bien au membre (une photo d'un autre membre est ignorée).
 * Avec `completer`, un champ vide prend la valeur d'exemple du designer (aperçu en cours de saisie).
 */
export async function preparerValeurs(gabarit: Gabarit, saisies: ValeursSaisies, userId: string, completer = false): Promise<ValeursPreparees> {
  const moteur: Valeurs = {};
  const stockees: ValeursSaisies = {};
  const exemples = completer ? valeursEssai(gabarit, "exemple") : {};
  for (const champ of gabarit.champs) {
    const brute = saisies[champ.nom];
    const vide = brute === null || brute === undefined || (typeof brute === "string" && !brute.trim());
    if (champ.type === "image") {
      const id = typeof brute === "string" && brute.startsWith(PREFIXE_TELEVERSEMENT) ? brute.slice(PREFIXE_TELEVERSEMENT.length) : null;
      const t = id && /^[0-9a-f-]{36}$/.test(id) ? (await db.select().from(schema.televersement).where(and(eq(schema.televersement.id, id), eq(schema.televersement.userId, userId))))[0] : undefined;
      if (t) {
        moteur[champ.nom] = await cheminDeTeleversement(t.cle);
        stockees[champ.nom] = PREFIXE_TELEVERSEMENT + t.id;
      } else if (completer) moteur[champ.nom] = PHOTO_ESSAI;
      continue;
    }
    if (vide) {
      if (completer) moteur[champ.nom] = exemples[champ.nom];
      continue;
    }
    const v = typeof brute === "number" ? brute : String(brute).slice(0, LONGUEUR_MAX);
    moteur[champ.nom] = v;
    stockees[champ.nom] = v;
  }
  return { moteur, stockees };
}

/** Titre par défaut d'un document : le gabarit et la valeur qui le distingue (un nom de préférence, sinon le premier texte). */
export function titreParDefaut(nomGabarit: string, gabarit: Gabarit, valeurs: ValeursSaisies): string {
  const textes = gabarit.champs.filter((c) => c.type === "texte" && typeof valeurs[c.nom] === "string" && String(valeurs[c.nom]).trim());
  const premier = textes.find((c) => /(^|_|\b)nom/i.test(`${c.nom} ${c.libelle ?? ""}`)) ?? textes[0];
  const texte = premier ? String(valeurs[premier.nom]).replace(/\s+/g, " ").trim() : "";
  return texte ? `${nomGabarit} – ${texte.slice(0, 80)}` : nomGabarit;
}
