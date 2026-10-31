import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ActionsDocument } from "@/fonctionnalites/documents/ActionsDocument";
import { dateFr } from "@/fonctionnalites/documents/CarteDocument";
import { libelleVisibilite } from "@/fonctionnalites/documents/partage";
import { ReglagesDocument } from "@/fonctionnalites/documents/ReglagesDocument";
import { documentLisible, type DocumentLisible } from "@/fonctionnalites/documents/requetes";
import { LARGEUR_HD } from "@/fonctionnalites/generation/rendu";
import { peutModifierDocument, peutValider } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";
import { cachetDeSection, historique, signatureDe, versionSuivante } from "@/fonctionnalites/administratif/circuit";
import { PanneauCircuit } from "@/fonctionnalites/administratif/PanneauCircuit";
import { definitionType } from "@/fonctionnalites/administratif/types";
import { blocDestinataire } from "@/fonctionnalites/administratif/envois";
import { FileArchive } from "lucide-react";
import type { Utilisateur } from "@/fonctionnalites/authentification/session";

export const metadata: Metadata = { title: "Document" };

function formatPlan(largeur: number, hauteur: number) {
  const r = hauteur / largeur;
  return r > 1.6 ? "Story" : r > 1.1 ? "Affiche" : r > 0.9 ? "Carré" : "Paysage";
}

/** Déclinaisons d'un document généré : la principale, puis les autres formats produits avec lui. */
function declinaisons(l: DocumentLisible) {
  const principale = { plan: l.d.plan!, largeur: l.d.largeur ?? 0, hauteur: l.d.hauteur ?? 0, principale: true };
  return [principale, ...l.d.declinaisons.map((x) => ({ plan: x.plan, largeur: x.largeur, hauteur: x.hauteur, principale: false }))];
}

function taille(octets: number | null) {
  if (!octets) return "";
  return octets > 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.ceil(octets / 1024)} Ko`;
}

/** Panneau de validation d'un document officiel : ce que le membre peut faire, ce qui manque, l'historique. */
async function circuitDe(l: DocumentLisible, u: Utilisateur, modifiable: boolean) {
  const m = await mandatCourant();
  const valideur = peutValider(u, m?.interim ?? false);
  const manque: string[] = [];
  if (valideur && l.d.etatValidation === "soumis") {
    if (!(await signatureDe(u.id))) manque.push("Ta signature n'est pas encore enregistrée.");
    if (m && !(await cachetDeSection(m.sectionId))) manque.push("Le cachet de la section n'est pas encore enregistré.");
  }
  return (
    <PanneauCircuit
      id={l.d.id}
      etat={l.d.etatValidation!}
      numero={l.d.numero}
      valideLe={l.d.valideLe ? dateFr(l.d.valideLe) : null}
      modifiable={modifiable}
      valideur={valideur}
      manque={manque}
      evenements={(await historique(l.d.id)).map((e) => ({ ...e, date: dateFr(e.date) }))}
      versionPrecedente={l.d.versionDeId}
      versionSuivante={await versionSuivante(l.d.id)}
    />
  );
}

export default async function PageDocument({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ plan?: string }> }) {
  const u = await exigerUtilisateur();
  const l = await documentLisible((await params).id, u);
  if (!l) notFound();
  const { plan: planDemande } = await searchParams;
  const genere = l.d.origine === "genere";
  const officiel = l.d.origine === "redige" && l.d.etatValidation ? definitionType(l.d.typeAdministratif ?? "") : undefined;
  const formats = genere ? declinaisons(l) : [];
  const choisi = formats.find((f) => f.plan === planDemande) ?? formats[0];
  const src = `/api/documents/${l.d.id}/fichier${choisi && !choisi.principale ? `?plan=${encodeURIComponent(choisi.plan)}` : officiel ? `?v=${l.d.updatedAt.getTime()}` : ""}`;
  const modifiable = peutModifierDocument(u, l.d);

  let hd: { largeur: number; hauteur: number } | undefined;
  if (genere && choisi && l.revision) {
    const p = l.revision.contenu.plans.find((x) => x.plan === choisi.plan);
    const largeurHd = Math.min(LARGEUR_HD, p?.largeur_px ?? choisi.largeur);
    if (largeurHd > choisi.largeur) hd = { largeur: largeurHd, hauteur: p ? Math.round((largeurHd * p.hauteur_px) / p.largeur_px) : choisi.hauteur };
  }

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/documents">Documents</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">{l.d.titre}</span>
      </nav>
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <div className="flex flex-col gap-4">
          {formats.length > 1 && (
            <nav aria-label="Formats" className="flex flex-wrap gap-1 self-start rounded-m bg-creme p-1">
              {formats.map((f) => (
                <Link
                  key={f.plan}
                  href={f.principale ? `/documents/${l.d.id}` : `/documents/${l.d.id}?plan=${encodeURIComponent(f.plan)}`}
                  aria-current={f === choisi ? "page" : undefined}
                  replace
                  scroll={false}
                  className={"flex min-h-10 items-center rounded-s px-3 text-sm no-underline " + (f === choisi ? "bg-surface-relevee font-semibold text-encre shadow-carte" : "text-encre-douce")}
                >
                  {formatPlan(f.largeur, f.hauteur)} · {f.largeur} × {f.hauteur}
                </Link>
              ))}
            </nav>
          )}
          {l.d.type === "application/pdf" ? (
            <div className="flex flex-col gap-3">
              <iframe src={src} title={`PDF « ${l.d.titre} »`} className="hidden h-[80vh] w-full rounded-l border border-trait bg-surface-relevee md:block" />
              <p className="m-0 rounded-l bg-creme p-6 md:hidden">
                Ce document est un PDF : <a href={src}>ouvre-le</a> ou télécharge-le.
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par l'API après contrôle de session
            <img
              src={src}
              alt={`Document « ${l.d.titre} »`}
              width={choisi?.largeur ?? l.d.largeur ?? undefined}
              height={choisi?.hauteur ?? l.d.hauteur ?? undefined}
              className="block h-auto w-full max-w-[640px] rounded-l border border-trait bg-surface-relevee shadow-carte"
            />
          )}
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="etiquette text-encre-douce">{genere ? l.gabarit : officiel ? `Document officiel · ${l.d.destinataires ? "Lettres en nombre" : officiel.libelle}` : "Fichier déposé"}</span>
            <h1 className="titre-2 m-0">{l.d.titre}</h1>
            <p className="m-0 text-sm leading-5 text-encre-douce">
              {l.d.auteurId !== u.id ? `Par ${l.auteur} le ` : "Créé le "}
              {dateFr(l.d.createdAt)}
              {genere ? ` · gabarit révision ${l.numero}` : ` · ${taille(l.d.taille)}`}
            </p>
            <p className="m-0 flex flex-wrap gap-2 text-sm">
              {l.d.statut === "brouillon" && !officiel && <span className="rounded-s bg-encre px-2 py-0.5 font-semibold text-surface">Brouillon</span>}
              <span className="rounded-s bg-creme px-2 py-0.5">
                {libelleVisibilite(l.d.visibilite)}
                {l.d.visibilite === "delegation" && l.delegation ? ` · ${l.delegation}` : ""}
              </span>
              {l.d.fige && <span className="rounded-s bg-creme px-2 py-0.5">Mandat {l.mandat} clos · lecture seule</span>}
            </p>
            {l.d.activiteId && l.activite && (
              <p className="m-0 text-sm">
                Activité : <Link href={`/activites/${l.d.activiteId}`}>{l.activite}</Link>
              </p>
            )}
          </div>
          {officiel && (await circuitDe(l, u, modifiable))}
          {l.d.destinataires && (
            <section aria-labelledby="titre-destinataires" className="flex flex-col gap-3">
              <h2 id="titre-destinataires" className="titre-3 m-0">
                {l.d.destinataires.length} destinataire{l.d.destinataires.length > 1 ? "s" : ""}
              </h2>
              {l.d.etatValidation === "valide" && (
                <a href={`/api/documents/${l.d.id}/lettres`} className="flex min-h-11 items-center gap-2 self-start font-semibold">
                  <FileArchive size={18} aria-hidden />
                  Lettres séparées (zip, un PDF par destinataire)
                </a>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-semibold">Voir la liste</summary>
                <ol className="mt-2 mb-0 flex max-h-80 flex-col gap-2 overflow-y-auto pl-6 text-sm">
                  {l.d.destinataires.map((d, i) => (
                    <li key={i} className="whitespace-pre-line">
                      {blocDestinataire(d)}
                    </li>
                  ))}
                </ol>
              </details>
            </section>
          )}
          <ActionsDocument
            id={l.d.id}
            titre={l.d.titre}
            plan={choisi && !choisi.principale ? choisi.plan : undefined}
            type={l.d.type}
            libelle={choisi ? `${choisi.largeur} × ${choisi.hauteur}` : l.d.type === "application/pdf" ? `PDF · ${taille(l.d.taille)}` : taille(l.d.taille)}
            hd={hd}
          />
          {modifiable && (
            <ReglagesDocument
              id={l.d.id}
              titre={l.d.titre}
              statut={l.d.statut}
              visibilite={l.d.visibilite}
              aUneDelegation={Boolean(l.d.delegationId)}
              publication={!officiel}
            />
          )}
          {genere && l.gabaritId && (
            <Link href={`/creer/${l.gabaritId}`} className="font-semibold">
              Créer un autre document avec ce gabarit
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
