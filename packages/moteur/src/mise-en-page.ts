/**
 * Mise en page DANS LE NAVIGATEUR (sérialisée par Playwright : aucune dépendance, aucun import).
 * Crée les zones dans le SVG, mesure le texte et applique les règles calibrées sur des PSD
 * réels (aeemci-studio/docs/05) :
 * - texte de point : ancre = ligne de base ; centré ou à droite, décalage d'une approche
 *   (Photoshop ignore l'espacement final) ;
 * - faux gras : contour de la couleur du texte + approche supplémentaire, 3 % de la taille ;
 * - paragraphe : première ligne de base = haut du cadre + hauteur réelle des capitales ;
 * - débordement : réduire jusqu'à la taille minimale, ou couper avec « … ».
 */

export interface ConsigneTexte {
  genre: "texte";
  champ: string;
  texte: string;
  police: string; // alias CSS
  forme: "point" | "box";
  x: number;
  y: number; // ligne de base (point) ou haut du cadre (box)
  largeur: number; // largeur_max (point) ou largeur du cadre (box)
  hauteur?: number; // hauteur du cadre (box)
  taille: number;
  tailleMin: number;
  interlignage?: number;
  approcheEm: number;
  fauxGras: boolean;
  couleur: string;
  alignement: "gauche" | "centre" | "droite" | "justifie";
  debordement: "reduire" | "couper" | "refuser";
}
export interface ConsigneImage {
  genre: "image";
  champ: string;
  url: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  ajustement: "couvrir" | "contenir";
  rayons?: [number, number, number, number];
  contour?: { epaisseur: number; couleur: string; position: "interieur" | "centre"; opacite?: number };
}
export interface ConsigneJauge {
  genre: "jauge";
  champ: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  ratio: number;
  sens: "horizontal" | "vertical";
  couleur: string;
}
export interface ConsigneCouche {
  genre: "couche";
  champ: string; // nom du calque, pour le rapport
  url: string;
  largeur: number;
  hauteur: number;
  mode: string;
}
export type Consigne = ConsigneTexte | ConsigneImage | ConsigneJauge | ConsigneCouche;

export interface RapportZone {
  champ: string;
  texte?: string;
  taille?: number;
  reduit?: boolean;
  coupe?: boolean;
  lignes?: number;
  depasse?: boolean;
}

export async function miseEnPage(consignes: Consigne[]): Promise<RapportZone[]> {
  const FAUX_GRAS = 0.03;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("zones") as unknown as SVGGElement;
  await document.fonts.ready;
  const rapport: RapportZone[] = [];
  const canvas = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
  let n = 0;

  for (const c of consignes) {
    if (c.genre === "couche") {
      rapport.push({ champ: c.champ });
      const im = document.createElementNS(NS, "image");
      for (const [k, v] of Object.entries({ x: 0, y: 0, width: c.largeur, height: c.hauteur })) im.setAttribute(k, String(v));
      im.setAttribute("href", c.url);
      im.setAttribute("preserveAspectRatio", "none");
      if (c.mode !== "normal") im.setAttribute("style", `mix-blend-mode:${c.mode}`);
      svg.appendChild(im);
      await new Promise<void>((ok) => {
        const fin = () => ok();
        im.addEventListener("load", fin, { once: true });
        im.addEventListener("error", fin, { once: true });
        setTimeout(fin, 10000);
      });
      continue;
    }
    if (c.genre === "image") {
      const id = `clip${n++}`;
      const clip = document.createElementNS(NS, "clipPath");
      clip.setAttribute("id", id);
      // Cadre du masque d'écrêtage, coins arrondis compris (rayons limités à la moitié du cadre).
      const lim = Math.min(c.largeur, c.hauteur) / 2;
      const [hg, hd, bd, bg] = (c.rayons ?? [0, 0, 0, 0]).map((v) => Math.min(Math.max(0, v), lim));
      const { x, y, largeur: w, hauteur: h } = c;
      const forme = document.createElementNS(NS, "path");
      forme.setAttribute(
        "d",
        `M${x + hg},${y} H${x + w - hd} A${hd},${hd} 0 0 1 ${x + w},${y + hd} V${y + h - bd} A${bd},${bd} 0 0 1 ${x + w - bd},${y + h} ` +
          `H${x + bg} A${bg},${bg} 0 0 1 ${x},${y + h - bg} V${y + hg} A${hg},${hg} 0 0 1 ${x + hg},${y} Z`,
      );
      clip.appendChild(forme);
      svg.appendChild(clip);
      const im = document.createElementNS(NS, "image");
      for (const [k, v] of Object.entries({ x: c.x, y: c.y, width: c.largeur, height: c.hauteur })) im.setAttribute(k, String(v));
      im.setAttribute("href", c.url);
      im.setAttribute("preserveAspectRatio", c.ajustement === "contenir" ? "xMidYMid meet" : "xMidYMid slice");
      im.setAttribute("clip-path", `url(#${id})`);
      svg.appendChild(im);
      // Contour de la forme (liseré) : la photo l'a recouvert à l'intérieur du cadre, on le redessine.
      // Découpé par le même cadre, un trait de largeur 2e (intérieur) ou e (centré) laisse la bonne part.
      if (c.contour && c.contour.epaisseur > 0) {
        const trait = document.createElementNS(NS, "path");
        trait.setAttribute("d", forme.getAttribute("d") || "");
        trait.setAttribute("fill", "none");
        trait.setAttribute("stroke", c.contour.couleur);
        trait.setAttribute("stroke-width", String(c.contour.position === "centre" ? c.contour.epaisseur : 2 * c.contour.epaisseur));
        if (c.contour.opacite !== undefined) trait.setAttribute("stroke-opacity", String(c.contour.opacite));
        trait.setAttribute("clip-path", `url(#${id})`);
        svg.appendChild(trait);
      }
      await new Promise<void>((ok) => {
        const fin = () => ok();
        im.addEventListener("load", fin, { once: true });
        im.addEventListener("error", fin, { once: true });
        setTimeout(fin, 5000);
      });
      rapport.push({ champ: c.champ });
      continue;
    }
    if (c.genre === "jauge") {
      const r = document.createElementNS(NS, "rect");
      const ratio = Math.max(0, Math.min(1, c.ratio));
      const horizontal = c.sens !== "vertical";
      r.setAttribute("x", String(c.x));
      r.setAttribute("y", String(horizontal ? c.y : c.y + c.hauteur * (1 - ratio)));
      r.setAttribute("width", String(horizontal ? c.largeur * ratio : c.largeur));
      r.setAttribute("height", String(horizontal ? c.hauteur : c.hauteur * ratio));
      r.setAttribute("rx", String(Math.min(c.hauteur, c.largeur) / 2));
      r.setAttribute("fill", c.couleur);
      svg.appendChild(r);
      rapport.push({ champ: c.champ });
      continue;
    }

    // ----- Texte -----
    const t = document.createElementNS(NS, "text");
    t.setAttribute("font-family", c.police);
    t.setAttribute("fill", c.couleur);
    t.setAttribute("xml:space", "preserve");
    if (c.fauxGras) {
      t.setAttribute("stroke", c.couleur);
      t.setAttribute("stroke-linejoin", "round");
    }
    const ancre = c.alignement === "centre" ? "middle" : c.alignement === "droite" ? "end" : "start";
    t.setAttribute("text-anchor", ancre);
    svg.appendChild(t);

    const regler = (taille: number) => {
      const ls = (c.approcheEm + (c.fauxGras ? FAUX_GRAS : 0)) * taille;
      t.setAttribute("font-size", String(taille));
      t.setAttribute("letter-spacing", String(ls));
      if (c.fauxGras) t.setAttribute("stroke-width", String(FAUX_GRAS * taille));
      return ls;
    };
    const decalage = (ls: number) => (c.alignement === "centre" || c.alignement === "droite" ? ls : 0);
    const mesurer = (s: string) => {
      t.textContent = s;
      return t.getComputedTextLength();
    };

    if (c.forme === "point") {
      const texte = c.texte.replace(/\n+/g, " ");
      let taille = c.taille;
      let ls = regler(taille);
      let largeur = mesurer(texte);
      let coupe = false;
      if (c.debordement === "reduire") {
        while (largeur > c.largeur && taille > c.tailleMin) {
          taille = Math.max(c.tailleMin, taille - Math.max(0.25, taille * 0.01));
          ls = regler(taille);
          largeur = mesurer(texte);
        }
      }
      if (largeur > c.largeur && c.debordement === "couper") {
        let s = texte;
        while (s.length > 1 && mesurer(`${s.trimEnd()}…`) > c.largeur) s = s.slice(0, -1);
        t.textContent = `${s.trimEnd()}…`;
        largeur = t.getComputedTextLength();
        coupe = true;
      }
      t.setAttribute("x", String(c.x + decalage(ls)));
      t.setAttribute("y", String(c.y));
      rapport.push({ champ: c.champ, texte: t.textContent || "", taille: Math.round(taille * 100) / 100, reduit: taille < c.taille, coupe, depasse: largeur > c.largeur + 0.5 });
      continue;
    }

    // Paragraphe : découpage en lignes dans la largeur du cadre, réduction si trop haut.
    const coupeLignes = (taille: number): string[] => {
      regler(taille);
      const lignes: string[] = [];
      for (const para of c.texte.split("\n")) {
        const mots = para.split(/ +/);
        let ligne = "";
        for (const mot of mots) {
          const essai = ligne ? `${ligne} ${mot}` : mot;
          if (ligne && mesurer(essai) > c.largeur) {
            lignes.push(ligne);
            ligne = mot;
          } else ligne = essai;
        }
        lignes.push(ligne);
      }
      return lignes;
    };
    const ascendante = (taille: number) => {
      canvas.font = `${taille}px ${c.police}`;
      return canvas.measureText("Hg").actualBoundingBoxAscent;
    };
    const hauteurBloc = (taille: number, nb: number) => {
      const pas = c.interlignage ? (c.interlignage * taille) / c.taille : taille * 1.2;
      canvas.font = `${taille}px ${c.police}`;
      const desc = canvas.measureText("g").actualBoundingBoxDescent;
      return { pas, h: ascendante(taille) + (nb - 1) * pas + desc };
    };
    let taille = c.taille;
    let lignes = coupeLignes(taille);
    const hauteur = c.hauteur ?? Infinity;
    if (c.debordement === "reduire") {
      while ((hauteurBloc(taille, lignes.length).h > hauteur + 1 || lignes.some((l) => mesurer(l) > c.largeur + 0.5)) && taille > c.tailleMin) {
        taille = Math.max(c.tailleMin, taille - Math.max(0.25, taille * 0.01));
        lignes = coupeLignes(taille);
      }
    }
    let coupe = false;
    const { pas } = hauteurBloc(taille, lignes.length);
    if (c.debordement === "couper") {
      while (lignes.length > 1 && hauteurBloc(taille, lignes.length).h > hauteur + 1) {
        lignes.pop();
        coupe = true;
      }
      if (coupe) lignes[lignes.length - 1] = `${lignes[lignes.length - 1].trimEnd()}…`;
    }
    const ls = regler(taille);
    const x = (c.alignement === "centre" ? c.x + c.largeur / 2 : c.alignement === "droite" ? c.x + c.largeur : c.x) + decalage(ls);
    t.textContent = "";
    lignes.forEach((l, i) => {
      const ts = document.createElementNS(NS, "tspan");
      ts.setAttribute("x", String(x));
      ts.setAttribute("y", String(c.y + ascendante(taille) + i * pas));
      ts.textContent = l;
      t.appendChild(ts);
    });
    rapport.push({
      champ: c.champ,
      texte: lignes.join("\n"),
      taille: Math.round(taille * 100) / 100,
      reduit: taille < c.taille,
      coupe,
      lignes: lignes.length,
      depasse: hauteurBloc(taille, lignes.length).h > hauteur + 1,
    });
  }
  return rapport;
}
