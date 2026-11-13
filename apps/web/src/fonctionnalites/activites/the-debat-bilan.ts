/**
 * Bilan d'une édition de la plateforme Thé Débat (site séparé), tel que son API `/api/bilan` le renvoie :
 * forme attendue et texte proposé pour le bilan de l'activité. Module sans dépendance serveur.
 */
import { z } from "zod";

const Nombre = z.number().int().min(0);
const Texte = (max: number) => z.string().max(max);

export const SchemaResultats = z.object({
  edition: z.object({ id: Texte(64), titre: Texte(300), date: z.string().nullable(), lieu: Texte(300).nullable(), statut: Texte(40) }),
  vote: z.object({ votants: Nombre, themes: z.array(z.object({ titre: Texte(300), voix: Nombre, retenu: z.boolean() })).max(100) }),
  debatteurs: z.array(z.object({ theme: Texte(300), camp: z.enum(["pour", "contre"]), nom: Texte(200), filiere: Texte(200).nullable() })).max(300),
  inscriptions: z.object({ validees: Nombre, listeAttente: Nombre }),
  presence: z.object({ presents: Nombre, parQr: Nombre, parRecherche: Nombre, ajoutesSurPlace: Nombre, debatteursPresents: Nombre }),
  genereLe: z.string(),
});

export type ResultatsTheDebat = z.infer<typeof SchemaResultats>;

export const SchemaEditions = z.object({
  editions: z.array(z.object({ id: Texte(64), titre: Texte(300), date: z.string().nullable(), statut: Texte(40) })).max(200),
});

export type EditionTheDebat = z.infer<typeof SchemaEditions>["editions"][number];

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

/** Thèmes retenus par le bureau, avec leurs débatteurs validés. */
export function themesDebattus(r: ResultatsTheDebat) {
  return r.vote.themes.filter((t) => t.retenu).map((t) => ({
    ...t,
    pour: r.debatteurs.filter((d) => d.theme === t.titre && d.camp === "pour").map((d) => d.nom),
    contre: r.debatteurs.filter((d) => d.theme === t.titre && d.camp === "contre").map((d) => d.nom),
  }));
}

/** Paragraphes proposés pour le bilan de l'activité : participation, vote, thèmes débattus. */
export function texteBilan(r: ResultatsTheDebat): string {
  const p = r.presence;
  const lignes: string[] = [];
  if (p.presents)
    lignes.push(
      `Participation : ${pluriel(p.presents, "présent")} (${p.parQr} par QR code${p.parRecherche ? `, ${p.parRecherche} retrouvé${p.parRecherche > 1 ? "s" : ""} à l'accueil` : ""}${p.ajoutesSurPlace ? `, ${pluriel(p.ajoutesSurPlace, "inscrit")} sur place` : ""}).`,
    );
  if (r.vote.votants) {
    const classement = r.vote.themes
      .filter((t) => t.voix)
      .map((t) => `« ${t.titre} » (${pluriel(t.voix, "voix", "voix")})`)
      .join(", ");
    lignes.push(`Vote des thèmes : ${pluriel(r.vote.votants, "votant")}. ${classement ? `Classement : ${classement}.` : ""}`.trim());
  }
  const themes = themesDebattus(r);
  if (themes.length)
    lignes.push(
      `Thèmes débattus :\n${themes
        .map((t) => `- « ${t.titre} » : pour, ${t.pour.length ? t.pour.join(", ") : "personne"} ; contre, ${t.contre.length ? t.contre.join(", ") : "personne"}.`)
        .join("\n")}`,
    );
  if (r.inscriptions.validees || r.inscriptions.listeAttente)
    lignes.push(
      `Débatteurs : ${pluriel(r.inscriptions.validees, "inscription validée", "inscriptions validées")}${r.inscriptions.listeAttente ? `, ${r.inscriptions.listeAttente} sur liste d'attente` : ""}${p.presents ? ` ; ${p.debatteursPresents} présent${p.debatteursPresents > 1 ? "s" : ""} le jour J` : ""}.`,
    );
  return lignes.join("\n\n");
}
