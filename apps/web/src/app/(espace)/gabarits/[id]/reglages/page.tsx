import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderUp } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { controlesDe } from "@/fonctionnalites/gabarits/atelier";
import { AtelierGabarit } from "@/fonctionnalites/gabarits/AtelierGabarit";
import { AbandonnerBrouillon, FicheGabarit, OuvrirBrouillon, RetablirRevision } from "@/fonctionnalites/gabarits/GestionGabarit";
import { ficheGabarit } from "@/fonctionnalites/gabarits/requetes";
import { peutGererGabarits } from "@/fonctionnalites/organisation/droits";
import { delegationsDe, mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Gabarit" };

const date = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

/** Écran d'un gabarit : réglages du brouillon avec aperçu, fiche, révisions publiées. */
export default async function PageReglagesGabarit({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerUtilisateur();
  if (!peutGererGabarits(u)) notFound();
  const g = await ficheGabarit((await params).id);
  if (!g) notFound();
  const m = await mandatCourant();
  const [delegations, controles] = await Promise.all([
    m ? delegationsDe(m.sectionId, m.id) : [],
    g.brouillon ? controlesDe({ id: g.brouillon.id, prefixe: g.brouillon.prefixe, contenu: g.brouillon.contenu }) : null,
  ]);
  const courante = g.revisions.find((r) => r.id === g.revisionCouranteId);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/gabarits/gerer">Gabarits</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">{g.nom}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="titre-1 m-0">{g.nom}</h1>
          <p className="m-0 text-encre-douce">
            {courante ? `Révision ${courante.numero} en service depuis le ${date(courante.publieeLe)}` : "Jamais publié"}
            {!g.actif && courante && " · non proposé aux membres"}
            {g.brouillon && ` · brouillon du ${date(g.brouillon.importeLe)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {courante && g.actif && (
            <Link href={`/creer/${g.id}`} className="flex min-h-11 items-center rounded-m border border-vert-esatic px-4 font-semibold no-underline">
              Essayer
            </Link>
          )}
          <Link href={`/gabarits/importer?gabarit=${g.id}`} className="flex min-h-11 items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold no-underline">
            <FolderUp size={18} aria-hidden />
            Nouvelle version depuis Photoshop
          </Link>
        </div>
      </div>

      <section aria-labelledby="titre-reglages" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titre-reglages" className="titre-2 m-0">
            Réglages du formulaire
          </h2>
          {g.brouillon && <AbandonnerBrouillon gabaritId={g.id} jamaisPublie={!courante} />}
        </div>
        {g.brouillon && controles ? (
          <AtelierGabarit key={g.brouillon.id} gabaritId={g.id} initial={g.brouillon.contenu} controlesInitiaux={controles} />
        ) : (
          <div className="flex flex-col gap-3 rounded-l bg-creme p-5">
            <p className="m-0">
              Libellés, aides, longueurs et comportement des textes trop longs se règlent dans un brouillon, avec l&apos;aperçu. Les membres gardent la
              révision en service jusqu&apos;à la publication.
            </p>
            <OuvrirBrouillon gabaritId={g.id} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="titre-fiche" className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
          <h2 id="titre-fiche" className="titre-2 m-0">
            Fiche
          </h2>
          <FicheGabarit
            gabaritId={g.id}
            nom={g.nom}
            description={g.description}
            actif={g.actif}
            publie={Boolean(courante)}
            delegations={delegations.filter((d) => !d.archivee || g.delegations.includes(d.id)).map(({ id, nom }) => ({ id, nom }))}
            reservees={g.delegations}
          />
        </section>
        <section aria-labelledby="titre-revisions" className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
          <h2 id="titre-revisions" className="titre-2 m-0">
            Révisions publiées
          </h2>
          {g.revisions.length ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {g.revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-trait py-3 last:border-b-0">
                  <div className="flex flex-col">
                    <span className="font-semibold">
                      Révision {r.numero}
                      {r.id === g.revisionCouranteId && <span className="ml-2 rounded-s bg-vert-esatic px-2 py-0.5 text-xs text-sur-vert">En service</span>}
                    </span>
                    <span className="text-sm text-encre-douce">
                      {date(r.publieeLe)}
                      {r.par && ` · ${r.par}`} · {r.documents} document{r.documents > 1 ? "s" : ""}
                    </span>
                  </div>
                  {r.id !== g.revisionCouranteId && <RetablirRevision gabaritId={g.id} revisionId={r.id} numero={r.numero} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-encre-douce">Aucune pour l&apos;instant.</p>
          )}
          <p className="m-0 text-sm text-encre-douce">Chaque document garde la révision avec laquelle il a été fait, et se refait à l&apos;identique.</p>
        </section>
      </div>
    </>
  );
}
