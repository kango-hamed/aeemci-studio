/**
 * Types du profil gabarit (manifest DesignHub 1.1, section `gabarit`).
 * Référence normative : design-tools/config/manifest.schema.json ($defs.gabarit, $defs.zone_gabarit).
 */

export type TypeChamp = "texte" | "date" | "nombre" | "image" | "jauge";
export type Alignement = "gauche" | "centre" | "droite" | "justifie";

export interface Champ {
  nom: string;
  type: TypeChamp;
  libelle?: string;
  /** Aide affichée sous le champ dans le formulaire. */
  aide?: string;
  obligatoire?: boolean;
  max_caracteres?: number;
  min?: number;
  max?: number;
}

export interface Cadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface StyleTexte {
  nom_postscript?: string;
  famille?: string;
  style?: string;
  taille_px: number;
  interlignage_px?: number;
  approche_em?: number;
  faux_gras?: boolean;
  couleur?: string;
  alignement?: Alignement;
}

export interface Zone {
  champ: string;
  calque?: string;
  /** Position dans la pile du document, 0 = tout en haut (ordre avec les couches). */
  pile?: number;
  forme?: "point" | "box";
  ancre?: { x: number; ligne_de_base: number };
  cadre?: Cadre;
  largeur_max?: number;
  conteneur?: string;
  texte?: StyleTexte;
  plages?: { debut: number; fin: number; nom_postscript?: string; taille_px?: number; couleur?: string }[];
  debordement?: { mode: "reduire" | "couper" | "refuser"; taille_min_px?: number };
  format?: string;
  modele?: string;
  exemple?: string;
  image?: { ajustement?: "couvrir" | "contenir"; ecretage?: string; /** Coins arrondis en px : haut-gauche, haut-droit, bas-droit, bas-gauche. */ rayons?: [number, number, number, number];
    /** Contour de la forme d'écrêtage, redessiné par-dessus la photo (intérieur ou centré). */
    contour?: { epaisseur: number; couleur: string; position: "interieur" | "centre"; opacite?: number } };
  jauge?: { sens?: "horizontal" | "vertical"; min?: number; max?: number; couleur?: string };
}

export type ModeFusion =
  | "normal" | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light" | "color-dodge" | "color-burn"
  | "darken" | "lighten" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";

/** Calque sorti du fond parce qu'il recouvre une zone : PNG transparent de la taille du plan. */
export interface Couche {
  calque?: string;
  pile: number;
  fichier: string;
  mode?: ModeFusion;
}

export interface Plan {
  plan: string;
  largeur_px: number;
  hauteur_px: number;
  fond?: string;
  zones: Zone[];
  couches?: Couche[];
}

export interface Gabarit {
  version: string;
  champs: Champ[];
  plans: Plan[];
}

/** Valeurs saisies dans le formulaire, par nom de champ. Image : chemin de fichier ou URL data:. */
export type Valeurs = Record<string, string | number | Date | null | undefined>;

/** Police disponible pour le rendu, retrouvée par son nom PostScript. */
export interface Police {
  nom_postscript: string;
  famille: string;
  graisse: number;
  italique?: boolean;
  fichier: string;
}
