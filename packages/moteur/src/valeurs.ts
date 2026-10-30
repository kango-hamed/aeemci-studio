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

/** Texte à afficher dans une zone pour la valeur saisie. */
export function texteDeZone(zone: Zone, champ: Champ, valeur: unknown): string {
  let texte: string;
  if (valeur === null || valeur === undefined || valeur === "") texte = "";
  else if (champ.type === "date") {
    const d = lireDate(valeur);
    texte = d ? calquerCasse(formaterDate(d, zone.format || "EEEE d MMMM yyyy", { locale: fr }).replace(/\.$/, ""), zone.exemple) : String(valeur);
  } else if (champ.type === "nombre") {
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
    const vide = v === null || v === undefined || (typeof v === "string" && !v.trim());
    const nom = c.libelle || c.nom;
    if (vide) {
      if (c.obligatoire !== false) erreurs.push({ champ: c.nom, message: `« ${nom} » est obligatoire.` });
      continue;
    }
    if (c.type === "nombre" || c.type === "jauge") {
      const n = lireNombre(v);
      if (n === null) erreurs.push({ champ: c.nom, message: `« ${nom} » doit être un nombre.` });
      else if (c.type === "jauge" && c.min !== undefined && c.max !== undefined && (n < Math.min(c.min, c.max) || n > Math.max(c.min, c.max))) {
        erreurs.push({ champ: c.nom, message: `« ${nom} » doit être compris entre ${formaterNombre(c.min)} et ${formaterNombre(c.max)}.` });
      }
    } else if (c.type === "date" && !lireDate(v)) {
      erreurs.push({ champ: c.nom, message: `« ${nom} » : date attendue au format AAAA-MM-JJ.` });
    } else if (c.type === "texte" && c.max_caracteres && String(v).length > c.max_caracteres) {
      const refuse = zones.some((z) => z.champ === c.nom && z.debordement?.mode === "refuser");
      if (refuse) erreurs.push({ champ: c.nom, message: `« ${nom} » : ${c.max_caracteres} caractères au plus (${String(v).length} saisis).` });
    }
  }
  return erreurs;
}
