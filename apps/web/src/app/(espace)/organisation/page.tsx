import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { peutGererOrganisation } from "@/fonctionnalites/organisation/droits";
import { GestionDelegations } from "@/fonctionnalites/organisation/GestionDelegations";
import { OngletMembres } from "@/fonctionnalites/organisation/OngletMembres";
import { PapierEnTete } from "@/fonctionnalites/organisation/PapierEnTete";
import { anciensMembres, delegationsDe, identiteSection, mandatCourant, membresDuMandat } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Organisation" };

const ONGLETS = [
  { cle: "membres", libelle: "Membres" },
  { cle: "delegations", libelle: "Délégations" },
  { cle: "papier", libelle: "Papier à en-tête" },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

/** Gestion par le bureau exécutif, un onglet par sujet : membres et rôles du mandat, délégations, papier à en-tête. */
export default async function PageOrganisation({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const u = await exigerUtilisateur();
  if (!peutGererOrganisation(u)) notFound();
  const demande = (await searchParams).onglet;
  const onglet: Onglet = ONGLETS.find((o) => o.cle === demande)?.cle ?? "membres";
  const mandat = await mandatCourant();

  if (!mandat)
    return (
      <>
        <h1 className="titre-1 m-0">Organisation</h1>
        <p className="m-0 rounded-l bg-creme p-6">
          Aucun mandat en cours. Crée-le avec le premier compte du bureau : <code>npm run admin:creer -- --role president --mandat 2026-2027 …</code>
        </p>
      </>
    );

  const [membres, delegations, anciens, papier] = await Promise.all([
    membresDuMandat(mandat.id),
    delegationsDe(mandat.sectionId, mandat.id),
    anciensMembres(mandat.id),
    identiteSection(mandat.sectionId),
  ]);
  const actives = delegations.filter((d) => !d.archivee).map(({ id, nom }) => ({ id, nom }));
  const compteurs: Record<Onglet, number | null> = { membres: membres.length, delegations: actives.length, papier: null };

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="etiquette text-encre-douce">
          Section {mandat.section} · Mandat {mandat.libelle}
        </span>
        <h1 className="titre-1 m-0">Organisation</h1>
        <p className="m-0 max-w-[720px] text-sm leading-5 text-encre-douce">
          Les droits suivent le rôle dans le mandat : un membre lit les documents de sa délégation, le bureau exécutif voit tout. Les designers gèrent
          les gabarits.
        </p>
      </div>

      <nav aria-label="Rubriques de l'organisation" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="m-0 flex w-max min-w-full list-none gap-1 border-b border-trait p-0">
          {ONGLETS.map((o) => {
            const actif = o.cle === onglet;
            return (
              <li key={o.cle}>
                <Link
                  href={o.cle === "membres" ? "/organisation" : `/organisation?onglet=${o.cle}`}
                  aria-current={actif ? "page" : undefined}
                  scroll={false}
                  className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 font-semibold whitespace-nowrap no-underline ${
                    actif ? "border-orange-croissant text-encre" : "border-transparent text-encre-douce hover:text-encre"
                  }`}
                >
                  {o.libelle}
                  {compteurs[o.cle] !== null && <span className="rounded-full bg-creme px-2 text-xs leading-5 font-semibold text-orange-texte">{compteurs[o.cle]}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {onglet === "membres" && <OngletMembres membres={membres} anciens={anciens} delegations={actives} moi={u.id} administrateur={u.estAdministrateur} />}

      {onglet === "delegations" && (
        <section className="flex flex-col gap-4" aria-label="Délégations">
          <GestionDelegations delegations={delegations} />
        </section>
      )}

      {onglet === "papier" && (
        <section className="flex flex-col gap-4" aria-label="Papier à en-tête">
          <p className="m-0 max-w-[720px] text-sm text-encre-douce">En-tête et pied de page des documents officiels : lettres, procès-verbaux, convocations, dossiers de passation.</p>
          <PapierEnTete section={mandat.section} saisie={papier.saisie} />
        </section>
      )}
    </>
  );
}
