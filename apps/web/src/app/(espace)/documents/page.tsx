import type { Metadata } from "next";
import Link from "next/link";
import { Search, Upload } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteDocument } from "@/fonctionnalites/documents/CarteDocument";
import { rechercherDocuments, type FiltresDocuments } from "@/fonctionnalites/documents/requetes";
import { estBureau, peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { delegationsDe, mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Documents" };

const LIMITE = 60;
const champ = "min-h-11 rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

type Parametres = Record<string, string | string[] | undefined>;

function un(p: Parametres, nom: string): string | undefined {
  const v = p[nom];
  return typeof v === "string" && v ? v : undefined;
}

/** Lit les filtres de l'adresse ; une valeur inconnue est ignorée. */
function filtres(p: Parametres): FiltresDocuments {
  const parmi = <T extends string>(v: string | undefined, permis: readonly T[]) => (permis.includes(v as T) ? (v as T) : undefined);
  const delegationId = un(p, "delegation");
  return {
    q: un(p, "q"),
    portee: parmi(un(p, "portee"), ["miens", "autres"] as const),
    origine: parmi(un(p, "origine"), ["genere", "depose"] as const),
    statut: parmi(un(p, "statut"), ["brouillon", "publie"] as const),
    delegationId: delegationId && /^[0-9a-f-]{36}$/.test(delegationId) ? delegationId : undefined,
  };
}

export default async function PageDocuments({ searchParams }: { searchParams: Promise<Parametres> }) {
  const u = await exigerUtilisateur();
  const f = filtres(await searchParams);
  const voitTout = u.estAdministrateur || estBureau(u);
  const mandat = voitTout ? await mandatCourant() : null;
  const [documents, delegations] = await Promise.all([rechercherDocuments(u, f, LIMITE), mandat ? delegationsDe(mandat.sectionId, mandat.id) : []]);
  const filtre = Boolean(f.q || f.portee || f.origine || f.statut || f.delegationId);
  const espace = voitTout ? "toute la section" : u.affectation?.delegation ? `la délégation ${u.affectation.delegation}` : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="titre-1 m-0">Documents</h1>
          <p className="m-0 max-w-[680px] text-encre-douce">
            {espace ? `Tes documents et ceux partagés avec toi, dans ${espace}.` : "Tes documents, et ceux que la section partage."}
          </p>
        </div>
        {peutCreerDocuments(u) && (
          <Link href="/documents/deposer" className="flex min-h-11 items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold no-underline">
            <Upload size={18} aria-hidden />
            Déposer un fichier
          </Link>
        )}
      </div>

      <form role="search" className="flex flex-wrap items-end gap-3 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte">
        <div className="flex min-w-[220px] flex-[2_1_260px] flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-semibold">
            Rechercher un titre
          </label>
          <input id="q" name="q" type="search" defaultValue={f.q} placeholder="Ex. : conférence, PV, Awa…" className={champ} />
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
          <label htmlFor="portee" className="text-sm font-semibold">
            Auteur
          </label>
          <select id="portee" name="portee" defaultValue={f.portee ?? ""} className={champ}>
            <option value="">Tous</option>
            <option value="miens">Moi</option>
            <option value="autres">Les autres</option>
          </select>
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
          <label htmlFor="origine" className="text-sm font-semibold">
            Type
          </label>
          <select id="origine" name="origine" defaultValue={f.origine ?? ""} className={champ}>
            <option value="">Tous</option>
            <option value="genere">Créés depuis un gabarit</option>
            <option value="depose">Fichiers déposés</option>
          </select>
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
          <label htmlFor="statut" className="text-sm font-semibold">
            Statut
          </label>
          <select id="statut" name="statut" defaultValue={f.statut ?? ""} className={champ}>
            <option value="">Tous</option>
            <option value="publie">Publiés</option>
            <option value="brouillon">Brouillons</option>
          </select>
        </div>
        {delegations.length > 0 && (
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <label htmlFor="delegation" className="text-sm font-semibold">
              Délégation
            </label>
            <select id="delegation" name="delegation" defaultValue={f.delegationId ?? ""} className={champ}>
              <option value="">Toutes</option>
              {delegations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert">
            <Search size={18} aria-hidden />
            Filtrer
          </button>
          {filtre && (
            <Link href="/documents" className="flex min-h-11 items-center rounded-m px-3 font-semibold">
              Effacer
            </Link>
          )}
        </div>
      </form>

      <p className="m-0 text-sm text-encre-douce" aria-live="polite">
        {documents.length === LIMITE
          ? `Les ${LIMITE} plus récents : précise la recherche pour retrouver un document plus ancien.`
          : `${documents.length} document${documents.length > 1 ? "s" : ""}`}
      </p>
      {documents.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6 p-0">
          {documents.map((d) => (
            <li key={d.id} className="flex">
              <CarteDocument d={d} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">
          {filtre ? (
            "Aucun document ne correspond à ces filtres."
          ) : (
            <>
              Aucun document pour l&apos;instant. <Link href="/gabarits">Choisis un gabarit pour commencer.</Link>
            </>
          )}
        </p>
      )}
    </>
  );
}
