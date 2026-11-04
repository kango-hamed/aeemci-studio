/**
 * Mise en page des documents administratifs : HTML A4 rendu en PDF par le moteur (mode document).
 * En-tête officiel (sceau national à gauche, croissant de la section à droite), numéro et date,
 * corps propre au type, bloc de signatures avec cachet ; pied institutionnel (rattachement,
 * coordonnées, devise) sur chaque page. Avant validation : pas de numéro ni de signature, sans filigrane.
 * En-tête et pied suivent le papier de la section (Organisation, `IdentiteSection`).
 *
 * Les ressources (polices, logos, signatures, cachet) sont désignées par leur nom ; l'appelant
 * fournit les fichiers (voir `rendu.ts`). Tout texte saisi passe par `echapperHtml`.
 */
import { echapperHtml as e, urlRessource } from "@aeemci-studio/moteur";
import type { IdentiteSection } from "@/fonctionnalites/organisation/identite";
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
  /** La signature porte déjà le cachet (une seule image, plus grande) : pas de cachet ajouté. */
  combinee?: boolean;
}

export interface DonneesMiseEnPage {
  type: DefinitionType;
  contenu: Record<string, string>;
  /** Numéro attribué à la validation ; `null` pour un projet. */
  numero: string | null;
  /** Date du document (validation, ou jour du projet). */
  date: Date;
  section: IdentiteSection;
  /** Un bloc (président) ; deux pour un procès-verbal (secrétaire de séance, président). */
  signatures: BlocSignature[];
}

export const RESSOURCES_FIXES = ["sceau", "croissant", "titre-400", "titre-700", "texte-400", "texte-600"] as const;
export const RESSOURCE_CACHET = "cachet";

const VILLE = "Abidjan";
export const DEVISE = "AEEMCI, pour une identité islamique !";

/** Marges des documents officiels (mm) : le bas laisse la place au pied institutionnel. */
export const MARGES_OFFICIELLES = { haut: 14, droite: 18, bas: 26, gauche: 18 };

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

/** Texte saisi, échappé, avec le gras : `**mot**` → <b>mot</b>. */
export function enrichi(t: string): string {
  return e(t).replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<b>$1</b>");
}

/** Fin de phrase ou de ligne voulue : après elle, un retour à la ligne est gardé. */
const FIN_VOULUE = /[.!?:;…»"]$/;
/** Début de ligne qu'on ne recolle jamais : puce, numéro, citation. */
const DEBUT_A_PART = /^(?:[-•*>«]|\d+[.)])/;

/**
 * Recolle les lignes coupées par un copier-coller depuis un PDF ou un traitement de texte
 * (« …dans la quiétude de la santé et de / l'esprit positif »). Une ligne est recollée à la précédente
 * si celle-ci ne finit pas une phrase et si elle commence par une minuscule ou « ( », ou si la
 * précédente est longue (coupure de mise en page). Les retours voulus (après un point, une puce…) restent.
 */
export function recoller(lignes: string[]): string[] {
  const sortie: string[] = [];
  for (const brute of lignes) {
    const l = brute.trim();
    const prec = sortie.at(-1);
    if (prec !== undefined && l && !FIN_VOULUE.test(prec) && !DEBUT_A_PART.test(l) && (/^[\p{Ll}(]/u.test(l) || prec.length >= 50)) {
      sortie[sortie.length - 1] = `${prec} ${l}`;
    } else sortie.push(l);
  }
  return sortie;
}

/**
 * Paragraphes séparés par une ligne vide, retours à la ligne voulus conservés, lignes coupées par un
 * copier-coller recollées. Une ligne qui commence par « ou par > ouvre une citation (verset, hadith…),
 * mise en valeur, avec sa référence entre parenthèses sur la ligne suivante ; les > sont retirés.
 * `**texte**` met en gras.
 */
export function paragraphes(t: string | undefined): string {
  return (t ?? "")
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => {
      // Blocs successifs : texte ordinaire, ou citation.
      const blocs: { citation: boolean; lignes: string[] }[] = [];
      for (const l of recoller(p.split("\n"))) {
        const dernier = blocs.at(-1);
        const citation = /^(>|«)/.test(l);
        let suite: boolean;
        if (!dernier) suite = false;
        else if (dernier.citation)
          // Dans une citation : ses lignes en >, sa référence « (Sourate 14, verset 31) », ou tant que le » n'est pas fermé.
          suite =
            l.startsWith(">") ||
            (/^\(.*\)\.?$/.test(l) && !/^\(.*\)\.?$/.test(dernier.lignes.at(-1)!)) ||
            (!l.startsWith("«") && !dernier.lignes.some((x) => /»\s*$/.test(x)));
        else suite = !citation;
        if (suite) dernier!.lignes.push(l);
        else blocs.push({ citation, lignes: [l] });
      }
      return blocs
        .map((b) =>
          b.citation
            ? `<blockquote class="citation">${b.lignes.map((l) => enrichi(l.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`
            : `<p>${b.lignes.map(enrichi).join("<br>")}</p>`,
        )
        .join("");
    })
    .join("");
}

/** Lignes saisies, échappées, séparées par des retours à la ligne. */
const lignes = (t: string | undefined) => e((t ?? "").trim()).replace(/\n/g, "<br>");

/** Salutation centrée : la première ligne (la formule) en gras, les suivantes (sa traduction) en dessous. */
function salutation(t: string | undefined): string {
  const [formule, ...suite] = (t ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!formule) return "";
  return `<div class="salutation"><div class="formule">${e(formule)}</div>${suite.map((l) => `<div>${e(l)}</div>`).join("")}</div>`;
}

/** « PJ : » suivi de la pièce, ou de la liste s'il y en a plusieurs. */
function piecesJointes(t: string | undefined): string {
  const pieces = (t ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)-])\s*/, "").trim())
    .filter(Boolean);
  if (!pieces.length) return "";
  const libelle = `<span class="libelle">PJ :</span>`;
  return pieces.length === 1 ? `<p class="pj">${libelle} ${e(pieces[0]!)}</p>` : `<div class="pj">${libelle}${liste(t)}</div>`;
}

/** Une entrée par ligne ; les puces ou numéros saisis sont retirés. */
export function liste(t: string | undefined, numerotee = false): string {
  const lignes = (t ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)-])\s*/, "").trim())
    .filter(Boolean);
  if (!lignes.length) return "";
  const balise = numerotee ? "ol" : "ul";
  return `<${balise}>${lignes.map((l) => `<li>${e(l)}</li>`).join("")}</${balise}>`;
}

export function tableau(lignes: [string, string][]): string {
  const remplies = lignes.filter(([, v]) => v.trim());
  return `<table class="infos">${remplies.map(([k, v]) => `<tr><th>${e(k)}</th><td>${v}</td></tr>`).join("")}</table>`;
}

export function rubrique(titre: string, contenu: string): string {
  return contenu ? `<section class="rubrique"><h2>${e(titre)}</h2>${contenu}</section>` : "";
}

function corps(d: DonneesMiseEnPage): string {
  const c = d.contenu;
  switch (d.type.code) {
    case "LET":
      return `
        <div class="destinataire">${lignes(c.destinataire)}</div>
        <p class="objet"><span class="libelle">Objet :</span> ${enrichi(c.objet ?? "")}</p>
        ${salutation(c.salutation)}
        <p class="appel">${enrichi(c.appel ?? "")}</p>
        <div class="texte retrait">${paragraphes(c.corps)}</div>
        ${piecesJointes(c.pieces)}`;
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
          <p>Je soussigné(e), ${qui} de l'Association des Élèves et Étudiants Musulmans de Côte d'Ivoire (AEEMCI), Section ${e(d.section.nom)}, atteste que <b>${e(c.beneficiaire ?? "")}</b>${qualite} ${e((c.objet ?? "").trim())}</p>
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
          ${s.signature ? `<img class="sig${s.combinee ? " combinee" : ""}" src="${urlRessource(s.signature)}" alt="">` : ""}
        </div>
        <div class="nom">${s.nom ? e(s.nom) : '<span class="attente">Signature à la validation</span>'}</div>
      </div>`,
  );
  return `<div class="signatures${blocs.length > 1 ? " deux" : ""}">${blocs.join("")}</div>`;
}

/** Polices, page et éléments communs aux documents officiels (lettres, dossiers de passation…). */
export const STYLE_PAGE = `@font-face{font-family:Titre;font-weight:400;src:url('${urlRessource("titre-400")}')}
@font-face{font-family:Titre;font-weight:700;src:url('${urlRessource("titre-700")}')}
@font-face{font-family:Texte;font-weight:400;src:url('${urlRessource("texte-400")}')}
@font-face{font-family:Texte;font-weight:600;src:url('${urlRessource("texte-600")}')}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Texte,sans-serif;font-size:11.5pt;line-height:1.45;color:#1f241f}
b{font-weight:600}
.entete{display:flex;align-items:center;gap:4mm}
.entete .sceau{width:24mm;height:24mm;object-fit:contain}
.entete .croissant{width:31mm;height:19mm;object-fit:contain}
.lignes{flex:1;text-align:center;font-family:Titre,sans-serif;font-size:8.8pt;line-height:1.38;color:#1f241f}
.lignes .sigle{font-weight:700;font-size:14pt;letter-spacing:.12em;color:#185431;margin-bottom:.5mm}
.lignes .initiale{font-weight:700;color:#185431}
.lignes .fort{font-weight:700}
.lignes .section{font-weight:700;font-size:10.5pt;color:#185431;letter-spacing:.04em}
.filet{position:relative;margin-top:3mm;border-top:1.6pt solid #185431;border-bottom:1.4pt solid #ea9129;height:1.6pt}
.filet::after{content:"";position:absolute;left:50%;top:50%;width:2.6mm;height:2.6mm;background:#ea9129;border:1.2pt solid #fff;transform:translate(-50%,-50%) rotate(45deg)}
.references{display:flex;justify-content:space-between;gap:6mm;font-size:9.5pt;margin:3mm 0 6mm}
.references .numero{font-family:Titre,sans-serif;font-weight:700;color:#185431}
.references .numero.projet{font-weight:400;color:#5a635b}
h1{font-family:Titre,sans-serif;font-weight:700;font-size:15pt;letter-spacing:.08em;text-transform:uppercase;text-align:center;color:#185431;margin:0 0 2mm}
.sous-titre{text-align:center;font-weight:600;font-size:12pt;margin:0 0 7mm}
h1+.texte,h1+.destinataire,h1+table{margin-top:7mm}
.destinataire{margin:0 0 6mm 50%;line-height:1.4;font-weight:600}
.objet{margin:0 0 5mm}
.objet .libelle,.pj .libelle{font-weight:600;text-decoration:underline}
.salutation{text-align:center;font-style:italic;margin:0 0 5mm}
.salutation .formule{font-weight:600}
.appel{margin:0 0 3mm;font-weight:600}
.texte p{margin:0 0 3mm;text-align:justify}
.texte.retrait p{text-indent:8mm}
blockquote.citation{margin:1mm 6mm 3mm;font-weight:600;font-style:italic;text-align:justify}
.pj{margin:3mm 0 0}
.pj ul{margin-top:1mm}
table.infos{border-collapse:collapse;width:100%;margin:0 0 6mm}
table.infos th{width:34mm;text-align:left;vertical-align:top;font-weight:600;color:#5a635b;padding:1.6mm 4mm 1.6mm 0;border-bottom:.5pt solid #daddd2}
table.infos td{vertical-align:top;padding:1.6mm 0;border-bottom:.5pt solid #daddd2}
.rubrique{margin:0 0 5mm}
.rubrique h2{font-family:Titre,sans-serif;font-weight:700;font-size:10pt;letter-spacing:.06em;text-transform:uppercase;color:#185431;margin:0 0 2mm}
.rubrique p{margin:0 0 3mm;text-align:justify}
ul,ol{margin:0;padding-left:6mm}
li{margin:0 0 1mm}
.signatures{display:flex;justify-content:flex-end;margin-top:2mm;break-inside:avoid}
.signatures.deux{justify-content:space-between}
.bloc{width:72mm;text-align:center}
.bloc .role{font-weight:600;text-decoration:underline}
.bloc .zone{position:relative;height:20mm}
/* Centrées par inset et marges automatiques, sans top:50% : la boîte avant translation dépassait la page et ajoutait une page blanche. */
.bloc .sig{position:absolute;inset:0;margin:auto;max-width:58mm;max-height:24mm}
.bloc .sig.combinee{max-width:66mm;max-height:30mm;mix-blend-mode:multiply}
.bloc .cachet{position:absolute;left:0;top:0;bottom:0;margin:auto 0;width:27mm;height:27mm;object-fit:contain;transform:rotate(-9deg);opacity:.88;mix-blend-mode:multiply}
.bloc .nom{font-family:Titre,sans-serif;font-weight:700}
.bloc .attente{font-family:Texte,sans-serif;font-weight:400;font-style:italic;color:#5a635b}
`;

/** « Association des Élèves… » avec les initiales du sigle en évidence. */
const ASSOCIATION = ["Association", "des", "Élèves", "et", "Étudiants", "Musulmans", "de", "Côte", "d'Ivoire"]
  .map((m) => {
    const initiale = /^(Association|Élèves|Étudiants|Musulmans|Côte)$/.test(m) ? 0 : m === "d'Ivoire" ? 2 : -1;
    return initiale < 0 ? e(m) : `${e(m.slice(0, initiale))}<span class="initiale">${e(m[initiale]!)}</span>${e(m.slice(initiale + 1))}`;
  })
  .join(" ");

/** En-tête officiel : sceau national à gauche, lignes de l'association, croissant de la section à droite. */
export function enteteOfficiel(s: IdentiteSection): string {
  return `<header class="entete">
  <img class="sceau" src="${urlRessource("sceau")}" alt="Sceau de l'AEEMCI">
  <div class="lignes">
    <div class="sigle">A.E.E.M.C.I</div>
    <div>${ASSOCIATION}</div>
    ${s.entete.map((l, i) => `<div${i ? ' class="fort"' : ""}>${e(l)}</div>`).join("")}
    <div class="section">Section ${e(s.nom)}</div>
  </div>
  <img class="croissant" src="${urlRessource("croissant")}" alt="Logo AEEMCI ${e(s.nom)}">
</header>
<div class="filet"></div>`;
}

/**
 * Pied institutionnel, répété sur chaque page du PDF (modèle Chromium) : rattachement, coordonnées, devise,
 * puis la référence du document et la pagination. Le modèle ne voit pas les polices du document : il déclare
 * les deux qu'il emploie sous ses propres noms (incorporées par le moteur). Styles en ligne.
 */
export function piedOfficiel(s: IdentiteSection, reference: string): string {
  const contacts = [s.email, s.telephones ? `Tél. : ${s.telephones}` : null].filter(Boolean).map((x) => e(x!)).join(" · ");
  return `<style>@font-face{font-family:PiedTitre;font-weight:700;src:url('${urlRessource("titre-700")}')}@font-face{font-family:PiedTexte;font-weight:400;src:url('${urlRessource("texte-400")}')}</style>
<div style="width:100%;margin:0 ${MARGES_OFFICIELLES.gauche}mm;text-align:center;font-family:PiedTexte,sans-serif;font-size:8px;line-height:1.4;color:#1f241f;-webkit-print-color-adjust:exact">
<div style="border-top:1.2px solid #185431;padding-top:5px;font-family:PiedTitre,sans-serif;font-weight:700;font-style:italic;font-size:8.2px">${e(s.rattachement)}</div>
${contacts ? `<div>${contacts}</div>` : ""}
<div style="font-family:PiedTitre,sans-serif;font-weight:700;font-size:8.8px;color:#185431;margin-top:1px">${e(DEVISE)}</div>
<div style="display:flex;justify-content:space-between;font-size:6.5px;color:#5a635b;margin-top:2px"><span>${e(reference)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>
</div>`;
}

/** Corps d'un document : en-tête, références, contenu propre au type, signatures. */
function pageDocument(d: DonneesMiseEnPage): string {
  return `${enteteOfficiel(d.section)}
<div class="references">
  <span class="numero${d.numero ? "" : " projet"}">N° ${d.numero ? e(d.numero) : "attribué à la validation"}</span>
  <span>${VILLE}, le ${e(dateLongue(d.date))}</span>
</div>
${corps(d)}
${signatures(d)}`;
}

function enveloppe(titre: string, contenu: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${e(titre)}</title>
<style>
${STYLE_PAGE}
.lettre{break-after:page}
.lettre:last-child{break-after:auto}
</style></head>
<body>
${contenu}
</body></html>`;
}

export function htmlDocument(d: DonneesMiseEnPage): string {
  return enveloppe(d.type.libelle, pageDocument(d));
}

/** Plusieurs lettres dans un même PDF, chacune sur ses pages (projet d'un envoi). */
export function htmlLettres(lettres: DonneesMiseEnPage[]): string {
  return enveloppe("Lettres", lettres.map((l) => `<section class="lettre">${pageDocument(l)}</section>`).join("\n"));
}

/** Pied de page d'un document administratif (HTML pour le moteur), répété sur chaque page. */
export function piedDocument(d: Pick<DonneesMiseEnPage, "numero" | "section">): string {
  return piedOfficiel(d.section, d.numero ? `N° ${d.numero}` : "Projet non validé");
}
