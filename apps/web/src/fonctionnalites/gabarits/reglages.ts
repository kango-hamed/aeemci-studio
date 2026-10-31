import type { Champ, Gabarit, Zone } from "@aeemci-studio/moteur";

/**
 * Réglages éditoriaux d'un gabarit : ce que Photoshop ne sait pas (libellé, aide, obligation, longueur,
 * comportement d'un texte trop long). Tout le reste (géométrie, styles, fichiers) vient du plugin et
 * n'est jamais modifié par l'écran du gabarit.
 */
const CHAMP = ["libelle", "aide", "obligatoire", "max_caracteres", "min", "max"] as const;
const ZONE = ["debordement", "largeur_max", "format", "modele"] as const;

function copier<T extends object>(cible: T, source: T, cles: readonly (keyof T)[]): T {
  const r = { ...cible };
  for (const k of cles) {
    if (source[k] === undefined) delete r[k];
    else r[k] = structuredClone(source[k]);
  }
  return r;
}

/** Clé d'une zone : plan, champ et rang parmi les zones du même champ dans ce plan. */
function clesDesZones(g: Gabarit): Map<string, Zone> {
  const m = new Map<string, Zone>();
  for (const p of g.plans) {
    const rangs = new Map<string, number>();
    for (const z of p.zones) {
      const n = rangs.get(z.champ) ?? 0;
      rangs.set(z.champ, n + 1);
      m.set(`${p.plan}\u0000${z.champ}\u0000${n}`, z);
    }
  }
  return m;
}

function avecZones(g: Gabarit, source: Map<string, Zone>): Gabarit["plans"] {
  return g.plans.map((p) => {
    const rangs = new Map<string, number>();
    return {
      ...p,
      zones: p.zones.map((z) => {
        const n = rangs.get(z.champ) ?? 0;
        rangs.set(z.champ, n + 1);
        const s = source.get(`${p.plan}\u0000${z.champ}\u0000${n}`);
        return s ? normaliserZone(copier(z, s, ZONE)) : z;
      }),
    };
  });
}

/**
 * Nouveau dossier du plugin pour un gabarit existant : reprend les réglages de l'ancienne version pour
 * les champs et zones qui existent encore, dans l'ordre du formulaire d'avant ; les nouveaux champs
 * viennent à la fin.
 */
export function fusionnerReglages(nouveau: Gabarit, ancien: Gabarit): Gabarit {
  const anciens = new Map(ancien.champs.map((c, i) => [c.nom, { c, i }]));
  const champs = nouveau.champs
    .map((c, j) => {
      const a = anciens.get(c.nom);
      return { c: a && a.c.type === c.type ? copier(c, a.c, CHAMP) : c, rang: a ? a.i : ancien.champs.length + j };
    })
    .sort((x, y) => x.rang - y.rang)
    .map((x) => x.c);
  return { ...nouveau, champs, plans: avecZones(nouveau, clesDesZones(ancien)) };
}

export class ReglagesInvalides extends Error {}

/**
 * Applique les réglages envoyés par l'écran du gabarit au contenu enregistré. Seuls les champs
 * éditoriaux sont lus ; l'ordre des champs est celui reçu, qui doit contenir exactement les mêmes champs.
 */
export function appliquerReglages(stocke: Gabarit, recu: Gabarit): Gabarit {
  if (!recu || !Array.isArray(recu.champs) || !Array.isArray(recu.plans)) throw new ReglagesInvalides("Réglages illisibles.");
  const parNom = new Map(stocke.champs.map((c) => [c.nom, c]));
  const noms = recu.champs.map((c) => c?.nom);
  if (noms.length !== parNom.size || new Set(noms).size !== noms.length || !noms.every((n) => parNom.has(n)))
    throw new ReglagesInvalides("Les champs ne correspondent plus au gabarit : recharge la page.");
  const champs = recu.champs.map((c) => normaliserChamp(copier(parNom.get(c.nom)!, c, CHAMP)));
  return { ...stocke, champs, plans: avecZones(stocke, clesDesZones(recu)) };
}

/** Types et bornes des réglages saisis : le contenu publié doit rester un manifest valide. */
function normaliserChamp(c: Champ): Champ {
  const r: Champ = { ...c };
  const texte = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const entier = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined);
  r.libelle = texte(c.libelle, 120);
  r.aide = texte(c.aide, 300);
  r.obligatoire = c.obligatoire === undefined ? undefined : Boolean(c.obligatoire);
  r.max_caracteres = entier(c.max_caracteres);
  r.min = typeof c.min === "number" && Number.isFinite(c.min) ? c.min : undefined;
  r.max = typeof c.max === "number" && Number.isFinite(c.max) ? c.max : undefined;
  for (const k of CHAMP) if (r[k] === undefined) delete r[k];
  return r;
}

function normaliserZone(z: Zone): Zone {
  const r: Zone = { ...z };
  const d = z.debordement;
  r.debordement =
    d && ["reduire", "couper", "refuser"].includes(d.mode)
      ? { mode: d.mode, ...(typeof d.taille_min_px === "number" && d.taille_min_px > 0 ? { taille_min_px: d.taille_min_px } : {}) }
      : undefined;
  r.largeur_max = typeof z.largeur_max === "number" && z.largeur_max > 0 ? z.largeur_max : undefined;
  r.format = typeof z.format === "string" && z.format.trim() ? z.format.trim().slice(0, 60) : undefined;
  r.modele = typeof z.modele === "string" && z.modele.includes("{valeur}") ? z.modele.slice(0, 120) : undefined;
  for (const k of ZONE) if (r[k] === undefined) delete r[k];
  return r;
}
