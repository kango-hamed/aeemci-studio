import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteActivite } from "@/fonctionnalites/activites/CarteActivite";
import { rechercherActivites, type ResumeActivite } from "@/fonctionnalites/activites/requetes";
import { estBureau, peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { delegationsDe, mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Activités" };

const champ = "min-h-11 rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

function Grille({ activites, passees, vide }: { activites: ResumeActivite[]; passees: boolean; vide: string }) {
  if (!activites.length) return <p className="m-0 rounded-l bg-creme p-6">{vide}</p>;
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
      {activites.map((a) => (
        <li key={a.id} className="flex">
          <CarteActivite a={a} passee={passees} />
        </li>
      ))}
    </ul>
  );
}

/** Activités du mandat en cours : à venir, puis passées (avec les bilans à faire). */
export default async function PageActivites({ searchParams }: { searchParams: Promise<{ delegation?: string }> }) {
  const u = await exigerUtilisateur();
  const m = await mandatCourant();
  const voitTout = u.estAdministrateur || estBureau(u);
  const { delegation } = await searchParams;
  const delegationId = delegation && /^[0-9a-f-]{36}$/.test(delegation) ? delegation : undefined;
  const [avenir, passees, delegations] = await Promise.all([
    m ? rechercherActivites(u, { mandatId: m.id, delegationId, quand: "avenir" }) : [],
    m ? rechercherActivites(u, { mandatId: m.id, delegationId, quand: "passees" }) : [],
    m && voitTout ? delegationsDe(m.sectionId, m.id) : [],
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="titre-1 m-0">Activités</h1>
          <p className="m-0 max-w-[680px] text-encre-douce">
            {m ? `Mandat ${m.libelle}. ` : ""}Chaque activité regroupe ses affiches, ses documents, ses photos et son bilan : ils forment le dossier de passation.
          </p>
        </div>
        {peutCreerDocuments(u) && (
          <Link href="/activites/nouvelle" className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert no-underline">
            <Plus size={18} aria-hidden />
            Nouvelle activité
          </Link>
        )}
      </div>
      {delegations.length > 0 && (
        <form className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <label htmlFor="delegation" className="text-sm font-semibold">
              Délégation
            </label>
            <select id="delegation" name="delegation" defaultValue={delegationId ?? ""} className={champ}>
              <option value="">Toutes</option>
              {delegations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="flex min-h-11 items-center rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic">
            Filtrer
          </button>
        </form>
      )}
      <section aria-labelledby="titre-avenir" className="flex flex-col gap-4">
        <h2 id="titre-avenir" className="titre-2 m-0">
          À venir
        </h2>
        <Grille activites={avenir} passees={false} vide="Aucune activité prévue." />
      </section>
      <section aria-labelledby="titre-passees" className="flex flex-col gap-4">
        <h2 id="titre-passees" className="titre-2 m-0">
          Passées
        </h2>
        <Grille activites={passees} passees vide="Aucune activité passée dans ce mandat." />
      </section>
    </>
  );
}
