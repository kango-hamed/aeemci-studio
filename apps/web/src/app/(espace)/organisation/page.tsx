import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { peutGererOrganisation } from "@/fonctionnalites/organisation/droits";
import { FormulaireMembre } from "@/fonctionnalites/organisation/FormulaireMembre";
import { GestionDelegations } from "@/fonctionnalites/organisation/GestionDelegations";
import { LigneMembre } from "@/fonctionnalites/organisation/LigneMembre";
import { anciensMembres, delegationsDe, mandatCourant, membresDuMandat } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Organisation" };

/** Gestion par le bureau exécutif : membres et rôles du mandat en cours, délégations. */
export default async function PageOrganisation() {
  const u = await exigerUtilisateur();
  if (!peutGererOrganisation(u)) notFound();
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

  const [membres, delegations, anciens] = await Promise.all([membresDuMandat(mandat.id), delegationsDe(mandat.sectionId, mandat.id), anciensMembres(mandat.id)]);
  const actives = delegations.filter((d) => !d.archivee).map(({ id, nom }) => ({ id, nom }));

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="etiquette text-encre-douce">
          Section {mandat.section} · Mandat {mandat.libelle}
        </span>
        <h1 className="titre-1 m-0">Organisation</h1>
        <p className="m-0 max-w-[720px] text-encre-douce">
          Les droits suivent le rôle dans le mandat : un membre lit les documents de sa délégation, le bureau exécutif voit tout. Un membre retiré du
          mandat garde ses documents mais ne crée plus rien.
        </p>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="titre-membres">
        <h2 id="titre-membres" className="titre-2 m-0">
          Membres du mandat <span className="font-normal text-encre-douce">({membres.length})</span>
        </h2>
        <FormulaireMembre delegations={actives} />
        <ul className="m-0 list-none rounded-l border border-trait bg-surface-relevee px-5 py-1 shadow-carte">
          {membres.map((m) => (
            <LigneMembre key={m.affectationId} m={m} delegations={actives} estMoi={m.userId === u.id} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="titre-delegations">
        <h2 id="titre-delegations" className="titre-2 m-0">
          Délégations
        </h2>
        <GestionDelegations delegations={delegations} />
      </section>

      {anciens.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="titre-anciens">
          <h2 id="titre-anciens" className="titre-2 m-0">
            Sans rôle dans ce mandat
          </h2>
          <p className="m-0 text-sm text-encre-douce">
            Pour leur redonner un rôle, ajoute-les avec la même adresse e-mail : leur compte et leurs documents sont conservés.
          </p>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
            {anciens.map((a) => (
              <li key={a.userId} className="flex flex-col rounded-m border border-trait bg-surface-relevee p-3">
                <span className="font-semibold">{a.nom}</span>
                <span className="text-sm break-all text-encre-douce">{a.email}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
