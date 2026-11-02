/**
 * Valeurs saisies → texte affiché : validation des champs, nombres et dates en français,
 * modèle « {valeur} », casse calquée sur l'exemple du designer. Sans navigateur.
 */
import { format as formaterDate, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { Champ, Gabarit, Valeurs, Zone } from "./types.ts";

export interface ErreurChamp {
  champ: string;
  message: string;
}

const ESPACE_INSECABLE = " ";

/** « 166 000 », « 166000,5 », 166000 → nombre ; null si illisible. */
export function lireNombre(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const propre = v.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(propre)) return null;
  return Number(propre);
}

/** Date ISO (2026-11-15), objet Date → Date ; null si illisible. */
export function lireDate(v: unknown): Date | null {
  if (v instanceof Date) return isValid(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const d = parseISO(v.trim());
  return isValid(d) ? d : null;
}

/** 3047900 → « 3 047 900 » (espaces insécables), 5.45 → « 5,45 ». */
export function formaterNombre(n: number): string {
  const [entier, decimales] = Math.abs(n).toFixed(Number.isInteger(n) ? 0 : 2).split(".");
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_INSECABLE);
  return `${n < 0 ? "-" : ""}${groupe}${decimales && decimales !== "00" ? `,${decimales.replace(/0$/, "")}` : ""}`;
}

/** Reprend la casse de l'exemple du designer : « SAM », « Sam » ou « sam. ». */
export function calquerCasse(texte: string, exemple?: string): string {
  if (!exemple || !texte) return texte;
  const lettres = exemple.replace(/[^\p{L}]/gu, "");
  if (lettres.length >= 2 && lettres === lettres.toUpperCase()) return texte.toUpperCase();
  if (/^\p{Lu}/u.test(exemple.trim())) return texte.charAt(0).toUpperCase() + texte.slice(1);
  return texte;
}

const vide = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim());

export interface EtatJauge {
  valeur: number | null;
  min: number;
  objectif: number;
  /** Remplissage de 0 à 1 : une valeur au-delà de l'objectif donne une jauge pleine. */
  ratio: number;
  /** Part de l'objectif atteinte, sans plafond (1,12 au-delà de l'objectif). */
  part: number;
}

/**
 * Jauge : sa valeur (saisie, ou prise dans le champ `valeur_de`), ses bornes (réglages du champ, puis
 * celles du calque) et l'objectif (champ `objectif_de` s'il est rempli, sinon le maximum).
 */
export function etatJauge(jauge: Champ, valeurs: Valeurs, zone?: Zone): EtatJauge {
  const valeur = lireNombre(valeurs[jauge.valeur_de ?? jauge.nom]);
  const min = jauge.min ?? zone?.jauge?.min ?? 0;
  const saisi = jauge.objectif_de ? lireNombre(valeurs[jauge.objectif_de]) : null;
  const objectif = saisi !== null && saisi > min ? saisi : jauge.max ?? zone?.jauge?.max ?? 100;
  const part = objectif === min || valeur === null ? 0 : (valeur - min) / (objectif - min);
  return { valeur, min, objectif, ratio: Math.max(0, Math.min(1, part)), part: Math.max(0, part) };
}

/** Jauge à laquelle se rapporte une zone de texte : la sienne, ou celle dont le champ donne la valeur ou l'objectif. */
function jaugeDe(gabarit: Gabarit, champ: Champ): Champ | undefined {
  if (champ.type === "jauge") return champ;
  const jauges = gabarit.champs.filter((c) => c.type === "jauge");
  return jauges.find((j) => j.valeur_de === champ.nom || j.objectif_de === champ.nom) ?? jauges[0];
}

/**
 * Texte à afficher dans une zone pour la valeur saisie. Avec le gabarit et toutes les valeurs, le
 * texte fixe peut aussi citer `{pourcentage}` et `{objectif}` de la jauge.
 */
export function texteDeZone(zone: Zone, champ: Champ, valeur: unknown, contexte?: { gabarit: Gabarit; valeurs: Valeurs }): string {
  const j = contexte && zone.modele && /\{(pourcentage|objectif)\}/.test(zone.modele) ? jaugeDe(contexte.gabarit, champ) : undefined;
  if (j) {
    const e = etatJauge(j, contexte!.valeurs, contexte!.gabarit.plans.flatMap((p) => p.zones).find((z) => z.champ === j.nom && z.jauge));
    if (champ.type === "jauge") valeur = e.valeur;
    if (vide(valeur) && e.valeur === null) return "";
    return zone.modele!
      .replace("{valeur}", vide(valeur) ? "" : texteDeZone({ ...zone, modele: undefined }, champ, valeur))
      .replace("{pourcentage}", `${Math.round(e.part * 100)}${ESPACE_INSECABLE}%`)
      .replace("{objectif}", formaterNombre(e.objectif))
      .replace(/ {2,}/g, " ")
      .trim();
  }
  let texte: string;
  if (valeur === null || valeur === undefined || valeur === "") texte = "";
  else if (champ.type === "date") {
    const d = lireDate(valeur);
    texte = d ? calquerCasse(formaterDate(d, zone.format || "EEEE d MMMM yyyy", { locale: fr }).replace(/\.$/, ""), zone.exemple) : String(valeur);
  } else if (champ.type === "nombre" || champ.type === "jauge") {
    const n = lireNombre(valeur);
    texte = n === null ? String(valeur) : formaterNombre(n);
  } else texte = String(valeur).replace(/\r\n?/g, "\n");
  if (zone.modele && texte) texte = zone.modele.replace("{valeur}", texte);
  return texte;
}

/** Vérifie les valeurs saisies avant le rendu. Une liste vide = rendu possible. */
export function validerValeurs(gabarit: Gabarit, valeurs: Valeurs): ErreurChamp[] {
  const erreurs: ErreurChamp[] = [];
  const zones = gabarit.plans.flatMap((p) => p.zones);
  for (const c of gabarit.champs) {
    const v = valeurs[c.nom];
    const estVide = vide(v);
    const nom = c.libelle || c.nom;
    // Jauge reliée à un autre champ : elle n'est pas demandée, ce champ est contrôlé pour elle.
    if (c.type === "jauge" && c.valeur_de) continue;
    if (estVide) {
      if (c.obligatoire !== false) erreurs.push({ champ: c.nom, message: `« ${nom} » est obligatoire.` });
      continue;
    }
    if (c.type === "nombre" || c.type === "jauge") {
      // Au-delà de l'objectif, la jauge est pleine : une collecte peut dépasser son objectif.
      if (lireNombre(v) === null) erreurs.push({ champ: c.nom, message: `« ${nom} » doit être un nombre.` });
    } else if (c.type === "date" && !lireDate(v)) {
      erreurs.push({ champ: c.nom, message: `« ${nom} » : date attendue au format AAAA-MM-JJ.` });
    } else if (c.type === "texte" && c.max_caracteres && String(v).length > c.max_caracteres) {
      const refuse = zones.some((z) => z.champ === c.nom && z.debordement?.mode === "refuser");
      if (refuse) erreurs.push({ champ: c.nom, message: `« ${nom} » : ${c.max_caracteres} caractères au plus (${String(v).length} saisis).` });
    }
  }
  return erreurs;
}
