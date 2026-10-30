/**
 * Contrôles avant publication et valeurs d'essai pour l'aperçu. Sans navigateur ni serveur.
 */
import fs from "node:fs";
import path from "node:path";
import { CataloguePolices } from "./polices.ts";
import type { Champ, Gabarit, Valeurs } from "./types.ts";

export interface Controles {
  /** Empêchent la publication. */
  bloquants: string[];
  /** À relire, sans bloquer. */
  remarques: string[];
}

export function controlerGabarit(gabarit: Gabarit, polices: CataloguePolices, dossier: string): Controles {
  const bloquants: string[] = [];
  const remarques: string[] = [];
  const noms = new Set<string>();
  for (const c of gabarit.champs) {
    if (noms.has(c.nom)) bloquants.push(`Champ « ${c.nom} » en double.`);
    noms.add(c.nom);
    if (!c.libelle || !c.libelle.trim()) bloquants.push(`Champ « ${c.nom} » : libellé vide.`);
    else if (
      c.libelle === c.nom ||
      /^[A-Z0-9 ]{4,}$/.test(c.libelle) ||
      gabarit.plans.some((p) => p.zones.some((z) => z.champ === c.nom && [z.exemple?.trim(), z.calque?.trim()].includes(c.libelle!.trim())))
    )
      remarques.push(`Champ « ${c.nom} » : le libellé « ${c.libelle} » ressemble à une valeur d'exemple ; écris plutôt la question posée (ex. « Nom du panéliste »).`);
    if (c.max_caracteres !== undefined && (!Number.isInteger(c.max_caracteres) || c.max_caracteres < 1)) bloquants.push(`Champ « ${c.libelle || c.nom} » : maximum de caractères invalide.`);
    if (c.type === "jauge" && (c.min === undefined || c.max === undefined || c.min === c.max)) bloquants.push(`Champ « ${c.libelle || c.nom} » : la jauge a besoin d'un minimum et d'un maximum différents.`);
    const zones = gabarit.plans.flatMap((p) => p.zones.filter((z) => z.champ === c.nom));
    if (!zones.length) bloquants.push(`Champ « ${c.libelle || c.nom} » : aucune zone ne l'utilise.`);
  }
  const policesUtiles = new Set<string>();
  for (const p of gabarit.plans) {
    if (!p.fond) bloquants.push(`Plan « ${p.plan} » : pas de fond.`);
    else if (!fs.existsSync(path.resolve(dossier, p.fond))) bloquants.push(`Plan « ${p.plan} » : fond introuvable (${p.fond}).`);
    for (const c of p.couches ?? []) if (!fs.existsSync(path.resolve(dossier, c.fichier))) bloquants.push(`Plan « ${p.plan} » : couche introuvable (${c.fichier}).`);
    for (const z of p.zones) {
      if (!noms.has(z.champ)) bloquants.push(`Plan « ${p.plan} » : une zone utilise le champ inconnu « ${z.champ} ».`);
      if (z.texte?.nom_postscript) policesUtiles.add(z.texte.nom_postscript);
      if (z.texte && z.debordement?.taille_min_px !== undefined && z.debordement.taille_min_px > z.texte.taille_px) {
        bloquants.push(`Plan « ${p.plan} », zone « ${z.champ} » : taille minimale supérieure à la taille d'origine.`);
      }
      if (z.forme !== "box" && z.texte && z.largeur_max !== undefined && z.largeur_max <= 0) bloquants.push(`Plan « ${p.plan} », zone « ${z.champ} » : largeur disponible nulle.`);
    }
  }
  for (const n of polices.manquantes(policesUtiles)) bloquants.push(`Police « ${n} » non installée sur le serveur de rendu.`);
  return { bloquants, remarques };
}

/** Photo de remplacement pour l'aperçu (silhouette neutre, SVG). */
export const PHOTO_ESSAI =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a8fa8"/><stop offset="1" stop-color="#8fc4b0"/></linearGradient></defs>` +
      `<rect width="600" height="800" fill="url(#d)"/><circle cx="300" cy="240" r="95" fill="#4a3a33"/><rect x="140" y="350" width="320" height="480" rx="110" fill="#2d5aa0"/></svg>`,
  ).toString("base64");

const DATE_EXEMPLE = "2026-11-15";
const DATE_LONGUE = "2026-09-30"; // « mercredi 30 septembre » : parmi les plus longues

function exempleDe(gabarit: Gabarit, champ: Champ): string | undefined {
  for (const p of gabarit.plans) for (const z of p.zones) if (z.champ === champ.nom && z.exemple) return z.exemple.replace(/\s+/g, " ").trim();
  return undefined;
}

/** Texte long plausible : l'exemple prolongé jusqu'au maximum autorisé (ou au double). */
function allonger(exemple: string, max: number): string {
  const mots = exemple.split(" ").filter(Boolean);
  let t = exemple;
  let i = 0;
  while (t.length < max && mots.length) t = `${t} ${mots[i++ % mots.length]}`;
  return t.slice(0, max).trim();
}

/** Valeurs d'essai : « exemple » (contenu du PSD) ou « long » (cas le plus défavorable). */
export function valeursEssai(gabarit: Gabarit, mode: "exemple" | "long"): Valeurs {
  const v: Valeurs = {};
  for (const c of gabarit.champs) {
    const ex = exempleDe(gabarit, c);
    if (c.type === "image") v[c.nom] = PHOTO_ESSAI;
    else if (c.type === "date") v[c.nom] = mode === "long" ? DATE_LONGUE : DATE_EXEMPLE;
    else if (c.type === "jauge") v[c.nom] = (c.min ?? 0) + ((c.max ?? 100) - (c.min ?? 0)) * (mode === "long" ? 1 : 0.6);
    else if (c.type === "nombre") {
      const n = Number((ex ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
      v[c.nom] = mode === "long" ? 999999999 : Number.isFinite(n) && n ? n : 125000;
    } else {
      const base = ex || c.libelle || c.nom;
      v[c.nom] = mode === "long" ? allonger(base, c.max_caracteres ?? Math.max(base.length * 2, 20)) : base;
    }
  }
  return v;
}
