import "server-only";
import { eq } from "drizzle-orm";
import { echapperHtml as e } from "@aeemci-studio/moteur";
import { db, schema } from "@/serveur/db";
import { creerZip } from "@/serveur/zip";
import { ressourcesFixes } from "@/fonctionnalites/administratif/circuit";
import { dateLongue, dateSaisie, enteteOfficiel, heureSaisie, MARGES_OFFICIELLES, piedOfficiel, rubrique, STYLE_PAGE } from "@/fonctionnalites/administratif/mise-en-page";
import { rendrePdfA4 } from "@/fonctionnalites/generation/rendu";
import { peutVoirContacts, type Acteur } from "@/fonctionnalites/organisation/droits";
import { identiteDe, type IdentiteSection } from "@/fonctionnalites/organisation/identite";
import { numeroAffiche } from "@/fonctionnalites/organisation/telephone";
import { LIBELLES_ROLES_EQUIPE } from "./organigramme-csv";
import { organigrammeDe, type Organigramme } from "./organigramme";
import { activiteLisible } from "./requetes";

/** Liste du comité d'organisation en PDF, avec l'en-tête officiel et les contacts : pour le seul comité. */

export interface DossierComite {
  section: IdentiteSection;
  titre: string;
  quand: string;
  lieu: string | null;
  organigramme: Organigramme;
}

/** `null` : activité introuvable, ou le demandeur n'est pas du comité. */
export async function dossierComite(u: Acteur, activiteId: string): Promise<DossierComite | null> {
  if (!/^[0-9a-f-]{36}$/.test(activiteId)) return null;
  const l = await activiteLisible(activiteId, u);
  if (!l || !peutVoirContacts(u, l.a)) return null;
  const [s] = await db
    .select({ section: schema.section.nom, entete: schema.section.entete, rattachement: schema.section.rattachement, email: schema.section.email, telephones: schema.section.telephones })
    .from(schema.mandat)
    .innerJoin(schema.section, eq(schema.mandat.sectionId, schema.section.id))
    .where(eq(schema.mandat.id, l.a.mandatId));
  return {
    section: identiteDe(s!.section, s!),
    titre: l.a.titre,
    quand: dateSaisie(l.a.date) + (l.a.heure ? ` à ${heureSaisie(l.a.heure)}` : ""),
    lieu: l.a.lieu,
    organigramme: await organigrammeDe(u, l.a),
  };
}

/**
 * Liste du comité ; avec `equipeId`, la fiche d'une seule commission (titre : son nom, la coordination
 * rappelée en tête). `null` : commission absente de l'organigramme.
 */
export function htmlComite(d: DossierComite, equipeId?: string): string | null {
  const o = d.organigramme;
  const fiche = equipeId ? o.equipes.find((q) => q.id === equipeId) : undefined;
  if (equipeId && !fiche) return null;
  const equipes = fiche ? [fiche] : o.equipes;
  const tel = (t: string | null) => (t ? e(numeroAffiche(t)) : "—");
  const tete = [o.pco && ["PCO", o.pco], o.adjoint && ["Adjoint du PCO", o.adjoint]].filter(Boolean) as [string, string][];
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${fiche ? e(fiche.nom) : "Comité d'organisation"}</title>
<style>
${STYLE_PAGE}
table.liste{border-collapse:collapse;width:100%}
table.liste td{padding:1.2mm 3mm 1.2mm 0;border-bottom:.5pt solid #daddd2;vertical-align:top}
table.liste td.role{width:28mm;color:#5a635b;font-size:9.5pt}
table.liste td.tel{width:42mm;white-space:nowrap;text-align:right}
.rubrique{break-inside:avoid}
.vide{color:#5a635b;font-style:italic;margin:0}
</style></head>
<body>
${enteteOfficiel(d.section)}
<div class="references"><span>${e(d.quand)}${d.lieu ? ` · ${e(d.lieu)}` : ""}</span><span>Abidjan, le ${e(dateLongue(new Date()))}</span></div>
<h1>${fiche ? e(fiche.nom) : "Comité d'organisation"}</h1>
<p class="sous-titre">${fiche ? `Comité d'organisation · ${e(d.titre)}` : e(d.titre)}</p>
${tete.length ? rubrique("Coordination", `<table class="liste">${tete.map(([r, n]) => `<tr><td class="role">${e(r)}</td><td>${e(n)}</td></tr>`).join("")}</table>`) : ""}
${
  equipes.length
    ? equipes
        .map((q) =>
          rubrique(
            fiche ? "Membres" : q.nom,
            q.membres.length
              ? `<table class="liste">${q.membres.map((m) => `<tr><td class="role">${e(LIBELLES_ROLES_EQUIPE[m.role])}</td><td>${e(m.nom)}</td><td class="tel">${tel(m.telephone)}</td></tr>`).join("")}</table>`
              : '<p class="vide">Personne pour l\'instant.</p>',
          ),
        )
        .join("")
    : '<p class="vide">Aucune commission.</p>'
}
</body></html>`;
}

/** PDF de la liste du comité, ou de la fiche d'une commission (`null` : commission inconnue). */
export async function pdfComite(d: DossierComite, equipeId?: string): Promise<Buffer | null> {
  const html = htmlComite(d, equipeId);
  if (!html) return null;
  const nom = equipeId ? d.organigramme.equipes.find((q) => q.id === equipeId)!.nom : "Comité d'organisation";
  return rendrePdfA4({ html, ressources: ressourcesFixes(), piedHtml: piedOfficiel(d.section, `${nom} · ${d.titre}`), marges: MARGES_OFFICIELLES });
}

/** Une fiche PDF par commission, réunies dans un zip (« 01-Logistique.pdf »…) ; `null` sans commission. */
export async function zipFichesCommissions(d: DossierComite): Promise<Buffer | null> {
  if (!d.organigramme.equipes.length) return null;
  const fichiers: { nom: string; contenu: Buffer }[] = [];
  // Une à une : la file des rendus est partagée avec les autres membres.
  for (const [i, q] of d.organigramme.equipes.entries())
    fichiers.push({ nom: `${String(i + 1).padStart(2, "0")}-${nomFichier(q.nom) || "commission"}.pdf`, contenu: (await pdfComite(d, q.id))! });
  return creerZip(fichiers);
}

/** Nom de fichier sûr : sans accents ni ponctuation. */
export const nomFichier = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
