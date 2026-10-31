import "server-only";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { echapperHtml as e } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { filtreLecture } from "@/fonctionnalites/documents/requetes";
import { filtreLectureActivite } from "@/fonctionnalites/activites/requetes";
import { ressourcesFixes } from "@/fonctionnalites/administratif/circuit";
import { dateLongue, dateSaisie, DEVISE, enteteOfficiel, paragraphes, rubrique, STYLE_PAGE } from "@/fonctionnalites/administratif/mise-en-page";
import { LIBELLES_ETATS } from "@/fonctionnalites/administratif/types";
import { rendrePdfA4 } from "@/fonctionnalites/generation/rendu";
import { peutEcrirePassation, peutLirePassation, type Acteur } from "@/fonctionnalites/organisation/droits";
import { LIBELLES_ROLES } from "@/fonctionnalites/organisation/roles";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

/**
 * Dossier de passation, par délégation (`cle` : son identifiant, ou « bureau ») et par mandat : membres,
 * activités et bilans, documents officiels validés, autres documents, points en suspens. Produit à la
 * demande en PDF avec l'en-tête officiel ; son contenu suit les droits de lecture de celui qui le demande.
 */

export const CLE_BUREAU = "bureau";
const delegationDeCle = (cle: string) => (cle === CLE_BUREAU ? null : cle);

export interface VoletPassation {
  cle: string;
  nom: string;
  note: string | null;
}

/** Volets du mandat que le membre peut lire : le bureau, puis les délégations actives ou présentes dans le mandat. */
export async function voletsDuMandat(u: Acteur, mandatId: string): Promise<VoletPassation[]> {
  const [m] = await db.select({ sectionId: schema.mandat.sectionId }).from(schema.mandat).where(eq(schema.mandat.id, mandatId));
  if (!m) return [];
  const present = (table: "affectation" | "activite" | "document") =>
    sql`exists (select 1 from ${sql.raw(table)} x where x.mandat_id = ${mandatId} and x.delegation_id = "delegation"."id")`;
  const delegations = await db
    .select({ id: schema.delegation.id, nom: schema.delegation.nom })
    .from(schema.delegation)
    .where(and(eq(schema.delegation.sectionId, m.sectionId), or(eq(schema.delegation.archivee, false), present("affectation"), present("activite"), present("document"))))
    .orderBy(asc(schema.delegation.nom));
  const notes = new Map(
    (await db.select({ cle: schema.notePassation.cle, texte: schema.notePassation.texte }).from(schema.notePassation).where(eq(schema.notePassation.mandatId, mandatId))).map((n) => [
      n.cle,
      n.texte,
    ]),
  );
  return [{ cle: CLE_BUREAU, nom: "Bureau exécutif" }, ...delegations.map((d) => ({ cle: d.id, nom: d.nom }))]
    .filter((v) => peutLirePassation(u, delegationDeCle(v.cle)))
    .map((v) => ({ ...v, note: notes.get(v.cle) ?? null }));
}

/** Points en suspens laissés au mandat suivant : mandat en cours seulement, par le responsable ou le bureau. */
export async function ecrireNote(u: Acteur, cle: string, texte: string): Promise<void> {
  if (!peutEcrirePassation(u, delegationDeCle(cle))) throw new ErreurSaisie("Seuls le responsable de la délégation et le bureau écrivent ses points en suspens.");
  const m = await mandatCourant();
  if (!m) throw new ErreurSaisie("Aucun mandat en cours.");
  if (cle !== CLE_BUREAU) {
    const [d] = await db.select({ id: schema.delegation.id }).from(schema.delegation).where(and(eq(schema.delegation.id, cle), eq(schema.delegation.sectionId, m.sectionId)));
    if (!d) throw new ErreurSaisie("Délégation inconnue.");
  }
  const t = texte.replace(/\r\n?/g, "\n").trim().slice(0, 8000);
  if (!t) {
    await db.delete(schema.notePassation).where(and(eq(schema.notePassation.mandatId, m.id), eq(schema.notePassation.cle, cle)));
    return;
  }
  await db
    .insert(schema.notePassation)
    .values({ mandatId: m.id, cle, texte: t, auteurId: u.id })
    .onConflictDoUpdate({ target: [schema.notePassation.mandatId, schema.notePassation.cle], set: { texte: t, auteurId: u.id, updatedAt: new Date() } });
}

export interface DossierPassation {
  section: string;
  mandat: string;
  clos: boolean;
  volet: string;
  membres: { nom: string; role: string }[];
  activites: { date: string; titre: string; lieu: string | null; bilan: string | null }[];
  officiels: { numero: string; titre: string }[];
  documents: { titre: string; origine: string; date: Date }[];
  enCours: { titre: string; etat: string }[];
  note: string | null;
}

/** Contenu du dossier, filtré par les droits de lecture du demandeur. `null` : volet inconnu ou non lisible. */
export async function dossierPassation(u: Acteur, mandatId: string, cle: string): Promise<DossierPassation | null> {
  if (!/^[0-9a-f-]{36}$/.test(mandatId)) return null;
  const volet = (await voletsDuMandat(u, mandatId)).find((v) => v.cle === cle);
  if (!volet) return null;
  const [m] = await db
    .select({ libelle: schema.mandat.libelle, statut: schema.mandat.statut, section: schema.section.nom })
    .from(schema.mandat)
    .innerJoin(schema.section, eq(schema.mandat.sectionId, schema.section.id))
    .where(eq(schema.mandat.id, mandatId));
  const delegationId = delegationDeCle(cle);
  const d = schema.document;
  const a = schema.activite;
  const deLaDelegation = <T extends typeof d | typeof a>(t: T) => (delegationId ? eq(t.delegationId, delegationId) : isNull(t.delegationId));

  const membres = await db
    .select({ nom: schema.user.name, role: schema.affectation.role })
    .from(schema.affectation)
    .innerJoin(schema.user, eq(schema.affectation.userId, schema.user.id))
    .where(and(eq(schema.affectation.mandatId, mandatId), delegationId ? eq(schema.affectation.delegationId, delegationId) : isNull(schema.affectation.delegationId)))
    // Ordre de l'énumération des rôles : président, vice-président, secrétaire général, responsable, membre.
    .orderBy(asc(schema.affectation.role), asc(schema.user.name));

  const activites = await db
    .select({ date: a.date, titre: a.titre, lieu: a.lieu, bilan: a.bilan })
    .from(a)
    .where(and(eq(a.mandatId, mandatId), deLaDelegation(a), filtreLectureActivite(u)))
    .orderBy(asc(a.date));
  const docs = await db
    .select({ titre: d.titre, origine: d.origine, numero: d.numero, etat: d.etatValidation, statut: d.statut, date: d.createdAt })
    .from(d)
    .where(and(eq(d.mandatId, mandatId), deLaDelegation(d), filtreLecture(u)))
    .orderBy(asc(d.createdAt));

  return {
    section: m!.section,
    mandat: m!.libelle,
    clos: m!.statut === "clos",
    volet: volet.nom,
    membres: membres.map((x) => ({ nom: x.nom, role: LIBELLES_ROLES[x.role] })),
    activites,
    officiels: docs.filter((x) => x.numero).map((x) => ({ numero: x.numero!, titre: x.titre })),
    documents: docs.filter((x) => x.origine !== "redige" && x.statut === "publie").map((x) => ({ titre: x.titre, origine: x.origine, date: x.date })),
    enCours: docs.filter((x) => x.origine === "redige" && x.etat !== "valide").map((x) => ({ titre: x.titre, etat: LIBELLES_ETATS[x.etat!] })),
    note: volet.note,
  };
}

const ORIGINES: Record<string, string> = { genere: "Visuel", depose: "Fichier déposé" };

export function htmlPassation(p: DossierPassation): string {
  const lignes = <T,>(liste: T[], vide: string, f: (x: T) => string) => (liste.length ? liste.map(f).join("") : `<p class="vide">${e(vide)}</p>`);
  const sansBilan = p.activites.filter((x) => !x.bilan && x.date < new Date().toISOString().slice(0, 10));
  const suspens = [
    p.note ? paragraphes(p.note) : "",
    p.enCours.length ? `<p>Documents officiels non validés :</p><ul>${p.enCours.map((x) => `<li>${e(x.titre)} (${e(x.etat.toLowerCase())})</li>`).join("")}</ul>` : "",
    sansBilan.length ? `<p>Activités passées sans bilan :</p><ul>${sansBilan.map((x) => `<li>${e(x.titre)} (${e(dateSaisie(x.date))})</li>`).join("")}</ul>` : "",
  ].join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Dossier de passation</title>
<style>
${STYLE_PAGE}
.activite{margin:0 0 4mm;break-inside:avoid}
.activite h3{font-family:Titre,sans-serif;font-size:10.5pt;margin:0}
.activite .quand{color:#5a635b;font-size:9.5pt;margin:0 0 1mm}
.activite p{margin:0 0 1.5mm;text-align:justify}
.vide{color:#5a635b;font-style:italic;margin:0}
table.liste{border-collapse:collapse;width:100%}
table.liste td{padding:1.2mm 3mm 1.2mm 0;border-bottom:.5pt solid #daddd2;vertical-align:top}
table.liste td.num{white-space:nowrap;font-weight:600;color:#185431;font-size:9.5pt}
</style></head>
<body>
${enteteOfficiel(p.section)}
<div class="references"><span>Mandat ${e(p.mandat)}${p.clos ? " (clos)" : " (en cours)"}</span><span>Abidjan, le ${e(dateLongue(new Date()))}</span></div>
<h1>Dossier de passation</h1>
<p class="sous-titre">${e(p.volet)}</p>
${rubrique("Membres du mandat", p.membres.length ? `<table class="liste">${p.membres.map((x) => `<tr><td>${e(x.nom)}</td><td>${e(x.role)}</td></tr>`).join("")}</table>` : `<p class="vide">Aucun membre affecté.</p>`)}
${rubrique(
  "Activités et bilans",
  lignes(
    p.activites,
    "Aucune activité enregistrée.",
    (x) =>
      `<div class="activite"><h3>${e(x.titre)}</h3><p class="quand">${e(dateSaisie(x.date))}${x.lieu ? ` · ${e(x.lieu)}` : ""}</p>${x.bilan ? paragraphes(x.bilan) : '<p class="vide">Pas de bilan.</p>'}</div>`,
  ),
)}
${rubrique(
  "Documents officiels validés",
  p.officiels.length ? `<table class="liste">${p.officiels.map((x) => `<tr><td class="num">${e(x.numero)}</td><td>${e(x.titre)}</td></tr>`).join("")}</table>` : `<p class="vide">Aucun.</p>`,
)}
${rubrique(
  "Autres documents",
  p.documents.length
    ? `<table class="liste">${p.documents.map((x) => `<tr><td>${e(x.titre)}</td><td>${e(ORIGINES[x.origine] ?? "")}</td><td>${e(dateLongue(x.date))}</td></tr>`).join("")}</table>`
    : `<p class="vide">Aucun.</p>`,
)}
${rubrique("Points en suspens", suspens || '<p class="vide">Aucun point signalé.</p>')}
<p class="devise">${e(DEVISE)}</p>
</body></html>`;
}

export async function pdfPassation(p: DossierPassation): Promise<Buffer> {
  return rendrePdfA4({ html: htmlPassation(p), ressources: ressourcesFixes(), pied: `AEEMCI Section ${p.section} · Passation ${p.mandat} · ${p.volet}` });
}
