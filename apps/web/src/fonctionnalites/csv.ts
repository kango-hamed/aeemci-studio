/**
 * Lecture des fichiers CSV déposés par les membres (Excel : Enregistrer sous › CSV) : destinataires
 * des lettres en nombre, membres du bureau à importer. Module sans dépendance serveur.
 */

/** UTF-8 (avec ou sans BOM), sinon Windows-1252 : ce qu'Excel produit en français. */
export function decoderCsv(octets: Uint8Array): string {
  let texte: string;
  try {
    texte = new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    texte = new TextDecoder("windows-1252").decode(octets);
  }
  return texte.replace(/^﻿/, "");
}

/** Séparateur de la première ligne : point-virgule (Excel français), virgule ou tabulation. */
export function separateurCsv(texte: string): string {
  const ligne = texte.split(/\r?\n/, 1)[0] ?? "";
  const compte = (c: string) => ligne.split(c).length - 1;
  return [";", ",", "\t"].reduce((a, b) => (compte(b) > compte(a) ? b : a));
}

/** Lignes et cellules d'un CSV (guillemets doublés, retours à la ligne dans une cellule). */
export function decouperCsv(texte: string, sep: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"' && cellule === "") guillemets = true;
    else if (c === sep) {
      ligne.push(cellule);
      cellule = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = "";
    } else cellule += c;
  }
  if (cellule !== "" || ligne.length) {
    ligne.push(cellule);
    lignes.push(ligne);
  }
  return lignes;
}

/** Lignes non vides d'un fichier CSV : la première est celle des intitulés. */
export function lignesCsv(octets: Uint8Array): string[][] {
  const texte = decoderCsv(octets);
  return decouperCsv(texte, separateurCsv(texte)).filter((l) => l.some((c) => c.trim()));
}

/** « Nom et Prénoms » → « nom_et_prenoms » : sans accents, minuscules, mots reliés par _. */
export function simplifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Valeur d'une cellule : retours à la ligne unifiés, caractères de contrôle retirés, espaces aux bords ôtés. */
export function nettoyerCellule(v: string | undefined, longueurMax: number): string {
  return (v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, longueurMax);
}

/** Fichier CSV proposé au téléchargement (BOM : Excel reconnaît l'UTF-8 et les accents). */
export function lienCsv(contenu: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + contenu)}`;
}
