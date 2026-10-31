/**
 * Lettres en nombre (publipostage) : une lettre type, une liste de destinataires importée d'un
 * fichier CSV, une lettre par destinataire. Les textes de la lettre type peuvent porter des
 * variables `{nom}`, `{fonction}`… remplacées par les colonnes du fichier.
 *
 * Module sans dépendance serveur : le formulaire s'en sert aussi pour afficher les variables.
 */

export type Destinataire = Record<string, string>;

export const MAX_DESTINATAIRES = 100;
export const TAILLE_MAX_CSV = 200 * 1024;
const LONGUEUR_MAX_VALEUR = 300;

/** Colonnes reconnues, avec les intitulés qu'on rencontre dans les fichiers. */
const COLONNES: Record<string, string[]> = {
  civilite: ["civilite", "titre", "appellation"],
  nom: ["nom", "nom_complet", "nom_et_prenoms", "nom_prenoms", "destinataire"],
  fonction: ["fonction", "qualite", "poste"],
  organisme: ["organisme", "structure", "entreprise", "organisation", "institution", "societe"],
  adresse: ["adresse", "ville", "localite"],
};

/** Colonnes qui composent le bloc destinataire, dans l'ordre des lignes. */
export const COLONNES_ADRESSE = ["civilite", "nom", "fonction", "organisme", "adresse"] as const;

export class ErreurEnvoi extends Error {}

/** « Nom et prénoms » → « nom_et_prenoms », puis nom reconnu s'il y en a un. */
export function normaliserColonne(entete: string): string {
  const brut = entete
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  for (const [nom, alias] of Object.entries(COLONNES)) if (alias.includes(brut)) return nom;
  return brut;
}

/** UTF-8 (avec ou sans BOM), sinon Windows-1252 : ce qu'Excel produit en français. */
function decoder(octets: Uint8Array): string {
  let texte: string;
  try {
    texte = new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    texte = new TextDecoder("windows-1252").decode(octets);
  }
  return texte.replace(/^﻿/, "");
}

/** Séparateur de la première ligne : point-virgule (Excel français), virgule ou tabulation. */
function separateur(texte: string): string {
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

/** Destinataires d'un fichier CSV : une ligne d'en-tête, puis une ligne par destinataire. */
export function lireCsv(octets: Uint8Array): Destinataire[] {
  if (octets.length > TAILLE_MAX_CSV) throw new ErreurEnvoi("Le fichier des destinataires dépasse 200 Ko.");
  const texte = decoder(octets);
  const [entete, ...lignes] = decouperCsv(texte, separateur(texte)).filter((l) => l.some((c) => c.trim()));
  if (!entete) throw new ErreurEnvoi("Le fichier des destinataires est vide.");
  const colonnes = entete.map(normaliserColonne);
  if (!colonnes.includes("nom") && !colonnes.includes("organisme"))
    throw new ErreurEnvoi("Le fichier doit avoir une colonne « nom » ou « organisme » (première ligne : les intitulés des colonnes).");
  const doublon = colonnes.find((c, i) => c && colonnes.indexOf(c) !== i);
  if (doublon) throw new ErreurEnvoi(`La colonne « ${doublon} » apparaît deux fois.`);
  if (!lignes.length) throw new ErreurEnvoi("Le fichier n'a aucun destinataire sous la ligne des intitulés.");
  if (lignes.length > MAX_DESTINATAIRES) throw new ErreurEnvoi(`${lignes.length} destinataires : un envoi en compte ${MAX_DESTINATAIRES} au plus. Partage la liste en plusieurs envois.`);

  return lignes.map((l, i) => {
    const d: Destinataire = {};
    colonnes.forEach((c, j) => {
      const v = (l[j] ?? "")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .trim();
      if (c && v) d[c] = v.slice(0, LONGUEUR_MAX_VALEUR);
    });
    if (!d.nom && !d.organisme) throw new ErreurEnvoi(`Ligne ${i + 2} du fichier : ni nom ni organisme.`);
    return d;
  });
}

/** Colonnes présentes dans la liste : celles de l'adresse dans leur ordre, puis les autres par nom (Postgres ne garde pas l'ordre des clés). */
export function colonnesDe(destinataires: Destinataire[]): string[] {
  const vues = new Set<string>();
  for (const d of destinataires) for (const c of Object.keys(d)) vues.add(c);
  const adresse: string[] = COLONNES_ADRESSE.filter((c) => vues.has(c));
  return [...adresse, ...[...vues].filter((c) => !adresse.includes(c)).sort()];
}

/** Variables `{nom}` d'un texte. */
export function variablesDe(texte: string): string[] {
  return [...new Set([...texte.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]!))];
}

export function remplacer(texte: string, d: Destinataire): string {
  return texte.replace(/\{([a-z0-9_]+)\}/g, (_, nom: string) => d[nom] ?? "").replace(/[ \t]{2,}/g, " ");
}

/** Bloc d'adresse : « Monsieur Koné Ibrahim », puis fonction, organisme et adresse sur leurs lignes. */
export function blocDestinataire(d: Destinataire): string {
  const premiere = [d.civilite, d.nom].filter(Boolean).join(" ");
  return [premiere, d.fonction, d.organisme, d.adresse].filter(Boolean).join("\n");
}

/** Champs de la lettre type où les variables sont permises. */
const CHAMPS_VARIABLES = ["objet", "appel", "corps", "pieces"];

/** Contenu de la lettre d'un destinataire : bloc d'adresse et variables remplacées. */
export function lettrePour(contenu: Record<string, string>, d: Destinataire): Record<string, string> {
  const lettre: Record<string, string> = { ...contenu, destinataire: blocDestinataire(d) };
  for (const c of CHAMPS_VARIABLES) if (contenu[c]) lettre[c] = remplacer(contenu[c], d).trim();
  return lettre;
}

/** Ce qui empêche l'envoi : liste vide, variable sans colonne, valeur manquante pour un destinataire. */
export function controlerEnvoi(contenu: Record<string, string>, destinataires: Destinataire[]): { champ: string; message: string }[] {
  if (!destinataires.length) return [{ champ: "destinataires", message: "Destinataires : importe la liste (fichier CSV)." }];
  const erreurs: { champ: string; message: string }[] = [];
  const colonnes = new Set(colonnesDe(destinataires));
  for (const champ of CHAMPS_VARIABLES) {
    for (const v of variablesDe(contenu[champ] ?? "")) {
      if (!colonnes.has(v)) {
        erreurs.push({ champ, message: `La variable {${v}} ne correspond à aucune colonne du fichier (${[...colonnes].map((c) => `{${c}}`).join(", ")}).` });
        continue;
      }
      const manquants = destinataires.map((d, i) => (d[v] ? 0 : i + 1)).filter(Boolean);
      if (manquants.length)
        erreurs.push({
          champ,
          message: `La variable {${v}} est vide pour ${manquants.length > 1 ? `${manquants.length} destinataires` : "un destinataire"} (ligne${manquants.length > 1 ? "s" : ""} ${manquants.slice(0, 6).join(", ")}${manquants.length > 6 ? "…" : ""} de la liste).`,
        });
    }
  }
  return erreurs.filter((e, i) => erreurs.findIndex((x) => x.message === e.message) === i);
}

/** Rang de la lettre dans l'envoi, ajouté au numéro : « 07 », ou « 007 » au-delà de 99 lettres. */
export function suffixeLettre(rang: number, total: number): string {
  return String(rang).padStart(Math.max(2, String(total).length), "0");
}

export const MODELE_CSV = "civilite;nom;fonction;organisme;adresse\nMonsieur;Koné Ibrahim;Directeur Général;ESATIC;Abidjan\nMadame;Traoré Awa;Présidente;Association des parents d'élèves;Treichville\n";

export type ModeleEnvoi = "invitation" | "dons" | "libre";

/** Activité vue par les modèles : `quand` est déjà mis en forme (« samedi 14 novembre 2026 à 15 h »). */
export interface ActiviteDuModele {
  titre: string;
  quand: string;
  lieu: string | null;
}

/** Textes de départ d'une invitation ou d'une demande de dons, à relire et adapter. */
export function texteDuModele(modele: ModeleEnvoi, a: ActiviteDuModele | null, section: string): Record<string, string> {
  const activite = a ? `« ${a.titre} »` : "[nom de l'activité]";
  const quand = a ? `le ${a.quand}${a.lieu ? `, ${a.lieu}` : ""}` : "le [date], [lieu]";
  if (modele === "invitation")
    return {
      objet: `Invitation : ${a?.titre ?? "[activité]"}`,
      appel: "{civilite} {fonction},",
      corps: `La Section ${section} de l'AEEMCI organise ${activite} ${quand}.\n\nNous avons l'honneur de vous inviter à prendre part à cette activité. Votre présence nous honorerait et marquerait l'intérêt que vous portez à notre association.\n\nDans l'attente de vous accueillir, nous vous prions d'agréer, {civilite} {fonction}, l'expression de notre haute considération.`,
    };
  if (modele === "dons")
    return {
      objet: `Demande de soutien : ${a?.titre ?? "[activité]"}`,
      appel: "{civilite} {fonction},",
      corps: `La Section ${section} de l'AEEMCI organise ${activite} ${quand}.\n\nPour mener à bien cette activité, nous sollicitons votre soutien, en nature ou en espèces, selon vos possibilités. Toute contribution, quelle qu'en soit la forme, sera reçue avec gratitude.\n\nNous restons à votre disposition pour tout renseignement complémentaire.\n\nDans l'attente d'une suite favorable, nous vous prions d'agréer, {civilite} {fonction}, l'expression de notre profonde gratitude.`,
    };
  return {};
}
