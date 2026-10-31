/**
 * Mise en page des documents administratifs : HTML A4 rendu en PDF par le moteur (mode document).
 * En-tête officiel (sceau national à gauche, croissant de la section à droite), numéro et date,
 * corps propre au type, bloc de signatures avec cachet. Avant validation : filigrane « PROJET ».
 *
 * Les ressources (polices, logos, signatures, cachet) sont désignées par leur nom ; l'appelant
 * fournit les fichiers (voir `rendu.ts`). Tout texte saisi passe par `echapperHtml`.
 */
import { echapperHtml as e, urlRessource } from "@aeemci-studio/moteur";
import type { DefinitionType } from "./types";

export interface BlocSignature {
  /** « Le Président », « Le Secrétaire de séance »… */
  titre: string;
  /** Vide tant que le signataire n'est pas connu. */
  nom: string;
  /** Nom de la ressource image de la signature, une fois validé. */
  signature?: string;
  /** Cachet de la section posé sur ce bloc, une fois validé. */
  cachet?: boolean;
}

export interface DonneesMiseEnPage {
  type: DefinitionType;
  contenu: Record<string, string>;
  /** Numéro attribué à la validation ; `null` pour un projet. */
  numero: string | null;
  /** Date du document (validation, ou jour du projet). */
  date: Date;
  section: string;
  /** Un bloc (président) ; deux pour un procès-verbal (secrétaire de séance, président). */
  signatures: BlocSignature[];
  projet: boolean;
}

export const RESSOURCES_FIXES = ["sceau", "croissant", "titre-400", "titre-700", "texte-400", "texte-600"] as const;
export const RESSOURCE_CACHET = "cachet";

const VILLE = "Abidjan";
export const DEVISE = "AEEMCI, pour une identité islamique !";

/** « 31 octobre 2026 » (« 1er » pour le premier du mois), à l'heure d'Abidjan. */
export function dateLongue(d: Date, jour = false): string {
  const parties = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan", day: "numeric", month: "long", year: "numeric", ...(jour ? { weekday: "long" } : {}) }).formatToParts(d);
  return parties.map((p) => (p.type === "day" && p.value === "1" ? "1er" : p.value)).join("");
}

/** « 2026-10-10 » saisi → « samedi 10 octobre 2026 ». */
export function dateSaisie(v: string | undefined): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  return dateLongue(new Date(`${v}T12:00:00Z`), true);
}

/** « 15:30 » → « 15 h 30 », « 15:00 » → « 15 h ». */
export function heureSaisie(v: string | undefined): string {
  const m = v?.match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  return `${Number(m[1])} h${m[2] === "00" ? "" : ` ${m[2]}`}`;
}

/** Paragraphes séparés par une ligne vide, retours à la ligne conservés. */
function paragraphes(t: string | undefined): string {
  return (t ?? "")
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${e(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Une entrée par ligne ; les puces ou numéros saisis sont retirés. */
function liste(t: string | undefined, numerotee = false): string {
  const lignes = (t ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)-])\s*/, "").trim())
    .filter(Boolean);
  if (!lignes.length) return "";
  const balise = numerotee ? "ol" : "ul";
  return `<${balise}>${lignes.map((l) => `<li>${e(l)}</li>`).join("")}</${balise}>`;
}

function tableau(lignes: [string, string][]): string {
  const remplies = lignes.filter(([, v]) => v.trim());
  return `<table class="infos">${remplies.map(([k, v]) => `<tr><th>${e(k)}</th><td>${v}</td></tr>`).join("")}</table>`;
}

function rubrique(titre: string, contenu: string): string {
  return contenu ? `<section class="rubrique"><h2>${e(titre)}</h2>${contenu}</section>` : "";
}

function corps(d: DonneesMiseEnPage): string {
  const c = d.contenu;
  switch (d.type.code) {
    case "LET":
      return `
        <div class="destinataire">${e(c.destinataire ?? "").trim().replace(/\n/g, "<br>")}</div>
        <p class="objet"><b>Objet :</b> ${e(c.objet ?? "")}</p>
        <p class="appel">${e(c.appel ?? "")}</p>
        <div class="texte">${paragraphes(c.corps)}</div>`;
    case "PV":
      return `
        <h1>Procès-verbal</h1>
        <p class="sous-titre">${e(c.reunion ?? "")}</p>
        ${tableau([
          ["Date", e(dateSaisie(c.date))],
          ["Horaire", e(c.fin ? `de ${heureSaisie(c.debut)} à ${heureSaisie(c.fin)}` : `à partir de ${heureSaisie(c.debut)}`)],
          ["Lieu", e(c.lieu ?? "")],
        ])}
        ${rubrique("Présents", liste(c.presents))}
        ${rubrique("Absents", liste(c.absents))}
        ${rubrique("Ordre du jour", liste(c.ordre, true))}
        ${rubrique("Déroulement", paragraphes(c.deroulement))}
        ${rubrique("Décisions et résolutions", liste(c.decisions))}`;
    case "CONV":
      return `
        <h1>Convocation</h1>
        <div class="destinataire">${e(c.destinataires ?? "").trim().replace(/\n/g, "<br>")}</div>
        <p class="objet"><b>Objet :</b> ${e(c.objet ?? "")}</p>
        <p>Vous êtes convoqués à la rencontre ci-dessous :</p>
        ${tableau([
          ["Date", e(dateSaisie(c.date))],
          ["Heure", e(heureSaisie(c.heure))],
          ["Lieu", e(c.lieu ?? "")],
        ])}
        ${rubrique("Ordre du jour", liste(c.ordre, true))}
        <div class="texte">${paragraphes(c.mot)}</div>`;
    case "COM":
      return `
        <h1>Communiqué</h1>
        <p class="sous-titre">${e(c.titre ?? "")}</p>
        <div class="texte">${paragraphes(c.corps)}</div>`;
    case "ATT": {
      const s = d.signatures.at(-1);
      const qui = s?.nom ? `${e(s.nom)}, ${e(s.titre.replace(/^Le /, ""))}` : "[nom du signataire], Président";
      const qualite = c.qualite?.trim() ? `, ${e(c.qualite.trim())},` : "";
      return `
        <h1>Attestation</h1>
        <div class="texte">
          <p>Je soussigné(e), ${qui} de l'Association des Élèves et Étudiants Musulmans de Côte d'Ivoire (AEEMCI), Section ${e(d.section)}, atteste que <b>${e(c.beneficiaire ?? "")}</b>${qualite} ${e((c.objet ?? "").trim())}</p>
          <p>En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.</p>
        </div>`;
    }
    case "OM":
      return `
        <h1>Ordre de mission</h1>
        ${tableau([
          ["Missionnaire", `<b>${e(c.missionnaire ?? "")}</b>`],
          ["Fonction", e(c.fonction ?? "")],
          ["Destination", e(c.destination ?? "")],
          ["Objet", e(c.objet ?? "").replace(/\n/g, "<br>")],
          ["Départ", e(dateSaisie(c.depart))],
          ["Retour", e(dateSaisie(c.retour))],
          ["Transport", e(c.transport ?? "")],
        ])}
        <div class="texte"><p>Les autorités compétentes sont priées de bien vouloir faciliter l'accomplissement de cette mission.</p></div>`;
  }
}

function signatures(d: DonneesMiseEnPage): string {
  const blocs = d.signatures.map(
    (s) => `
      <div class="bloc">
        <div class="role">${e(s.titre)}</div>
        <div class="zone">
          ${s.cachet ? `<img class="cachet" src="${urlRessource(RESSOURCE_CACHET)}" alt="">` : ""}
          ${s.signature ? `<img class="sig" src="${urlRessource(s.signature)}" alt="">` : ""}
        </div>
        <div class="nom">${s.nom ? e(s.nom) : '<span class="attente">Signature à la validation</span>'}</div>
      </div>`,
  );
  return `<div class="signatures${blocs.length > 1 ? " deux" : ""}">${blocs.join("")}</div>`;
}

export function htmlDocument(d: DonneesMiseEnPage): string {
  const r = urlRessource;
  const piecesJointes = d.type.code === "LET" ? rubrique("Pièces jointes", liste(d.contenu.pieces)) : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${e(d.type.libelle)}</title>
<style>
@font-face{font-family:Titre;font-weight:400;src:url('${r("titre-400")}')}
@font-face{font-family:Titre;font-weight:700;src:url('${r("titre-700")}')}
@font-face{font-family:Texte;font-weight:400;src:url('${r("texte-400")}')}
@font-face{font-family:Texte;font-weight:600;src:url('${r("texte-600")}')}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Texte,sans-serif;font-size:11.5pt;line-height:1.5;color:#1f241f}
b{font-weight:600}
.entete{display:flex;align-items:center;gap:4mm}
.entete .sceau{width:24mm;height:24mm;object-fit:contain}
.entete .croissant{width:31mm;height:19mm;object-fit:contain}
.lignes{flex:1;text-align:center;font-family:Titre,sans-serif;font-size:8.6pt;line-height:1.4;color:#185431}
.lignes .fort{font-weight:700;font-size:12.5pt;letter-spacing:.08em}
.filet{margin-top:3mm;border-top:1.6pt solid #185431;border-bottom:1.4pt solid #ea9129;height:1.6pt}
.references{display:flex;justify-content:space-between;gap:6mm;font-size:9.5pt;margin:4mm 0 9mm}
.references .numero{font-family:Titre,sans-serif;font-weight:700;color:#185431}
.references .numero.projet{font-weight:400;color:#5a635b}
h1{font-family:Titre,sans-serif;font-weight:700;font-size:15pt;letter-spacing:.08em;text-transform:uppercase;text-align:center;color:#185431;margin:0 0 2mm}
.sous-titre{text-align:center;font-weight:600;font-size:12pt;margin:0 0 7mm}
h1+.texte,h1+.destinataire,h1+table{margin-top:7mm}
.destinataire{margin:0 0 8mm 50%;line-height:1.45}
.objet{margin:0 0 6mm}
.appel{margin:0 0 4mm}
.texte p{margin:0 0 3.5mm;text-align:justify}
table.infos{border-collapse:collapse;width:100%;margin:0 0 6mm}
table.infos th{width:34mm;text-align:left;vertical-align:top;font-weight:600;color:#5a635b;padding:1.6mm 4mm 1.6mm 0;border-bottom:.5pt solid #daddd2}
table.infos td{vertical-align:top;padding:1.6mm 0;border-bottom:.5pt solid #daddd2}
.rubrique{margin:0 0 5mm}
.rubrique h2{font-family:Titre,sans-serif;font-weight:700;font-size:10pt;letter-spacing:.06em;text-transform:uppercase;color:#185431;margin:0 0 2mm}
.rubrique p{margin:0 0 3mm;text-align:justify}
ul,ol{margin:0;padding-left:6mm}
li{margin:0 0 1mm}
.signatures{display:flex;justify-content:flex-end;margin-top:10mm;break-inside:avoid}
.signatures.deux{justify-content:space-between}
.bloc{width:72mm;text-align:center}
.bloc .role{font-weight:600}
.bloc .zone{position:relative;height:32mm}
.bloc .sig{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:58mm;max-height:26mm}
.bloc .cachet{position:absolute;left:0;top:50%;width:31mm;height:31mm;object-fit:contain;transform:translateY(-50%) rotate(-9deg);opacity:.88;mix-blend-mode:multiply}
.bloc .nom{font-family:Titre,sans-serif;font-weight:700}
.bloc .attente{font-family:Texte,sans-serif;font-weight:400;font-style:italic;color:#5a635b}
.devise{margin-top:9mm;text-align:center;font-family:Titre,sans-serif;font-size:9.5pt;color:#185431}
.filigrane{position:fixed;left:50%;top:48%;transform:translate(-50%,-50%) rotate(-35deg);font-family:Titre,sans-serif;font-weight:700;font-size:120pt;letter-spacing:.12em;color:rgba(180,35,24,.1);pointer-events:none;white-space:nowrap}
</style></head>
<body>
${d.projet ? '<div class="filigrane" aria-hidden="true">PROJET</div>' : ""}
<header class="entete">
  <img class="sceau" src="${r("sceau")}" alt="Sceau de l'AEEMCI">
  <div class="lignes">
    <div class="fort">AEEMCI</div>
    <div>Association des Élèves et Étudiants Musulmans de Côte d'Ivoire</div>
    <div>Secrétariat Régional Abidjan Sud</div>
    <div>Sous Comité Treichville</div>
    <div class="fort">Section ${e(d.section)}</div>
  </div>
  <img class="croissant" src="${r("croissant")}" alt="Logo AEEMCI ${e(d.section)}">
</header>
<div class="filet"></div>
<div class="references">
  <span class="numero${d.numero ? "" : " projet"}">N° ${d.numero ? e(d.numero) : "attribué à la validation"}</span>
  <span>${VILLE}, le ${e(dateLongue(d.date))}</span>
</div>
${corps(d)}
${signatures(d)}
${piecesJointes}
<p class="devise">${e(DEVISE)}</p>
</body></html>`;
}

/** Texte du pied de page, répété sur chaque page. */
export function piedDocument(d: Pick<DonneesMiseEnPage, "numero" | "section">): string {
  return `AEEMCI Section ${d.section} · ${d.numero ?? "Projet non validé"}`;
}
