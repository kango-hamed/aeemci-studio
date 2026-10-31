import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, FolderInput, Search } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteActivite } from "@/fonctionnalites/activites/CarteActivite";
import { rechercherActivites } from "@/fonctionnalites/activites/requetes";
import { CarteDocument } from "@/fonctionnalites/documents/CarteDocument";
import { rechercherDocuments } from "@/fonctionnalites/documents/requetes";
import { mandatsDeLaSection } from "@/fonctionnalites/mandats/archives";
import { voletsDuMandat } from "@/fonctionnalites/mandats/passation";
import { estBureau } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Archives" };

const champ = "min-h-11 rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";
const LIMITE = 60;

/** Archives : tous les mandats, leurs dossiers de passation, et la recherche plein texte tous mandats confondus. */
export default async function PageArchives({ searchParams }: { searchParams: Promise<{ q?: string; mandat?: string }> }) {
  const u = await exigerUtilisateur();
  const courant = await mandatCourant();
  const mandats = courant ? await mandatsDeLaSection(courant.sectionId) : [];
  const { q, mandat } = await searchParams;
  const texte = q?.trim().slice(0, 200) || undefined;
  const mandatId = mandats.some((m) => m.id === mandat) ? mandat : undefined;
  const bureau = u.estAdministrateur || estBureau(u);
  const recherche = Boolean(texte || mandatId);
  const [documents, activites, volets] = await Promise.all([
    recherche ? rechercherDocuments(u, { texte, mandatId }, LIMITE) : [],
    recherche ? rechercherActivites(u, { texte, mandatId }, LIMITE) : [],
    Promise.all(mandats.map(async (m) => [m.id, await voletsDuMandat(u, m.id)] as const)).then((x) => new Map(x)),
  ]);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="titre-1 m-0">Archives</h1>
          <p className="m-0 max-w-[680px] text-encre-douce">Les mandats de la section, leurs dossiers de passation, et la recherche dans tous les documents et activités.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/passation" className="flex min-h-11 items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold no-underline">
            Préparer la passation
          </Link>
          {bureau && (
            <Link href="/archives/importer" className="flex min-h-11 items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold no-underline">
              <FolderInput size={18} aria-hidden />
              Importer d&apos;anciens dossiers
            </Link>
          )}
        </div>
      </div>

      <form role="search" className="flex flex-wrap items-end gap-3 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte">
        <div className="flex min-w-[220px] flex-[2_1_260px] flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-semibold">
            Rechercher
          </label>
          <input id="q" name="q" type="search" defaultValue={texte} placeholder="Ex. : conférence Maouloud, budget, attestation…" className={champ} />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <label htmlFor="mandat" className="text-sm font-semibold">
            Mandat
          </label>
          <select id="mandat" name="mandat" defaultValue={mandatId ?? ""} className={champ}>
            <option value="">Tous</option>
            {mandats.map((m) => (
              <option key={m.id} value={m.id}>
                {m.libelle}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert">
          <Search size={18} aria-hidden />
          Rechercher
        </button>
        {recherche && (
          <Link href="/archives" className="flex min-h-11 items-center rounded-m px-3 font-semibold">
            Effacer
          </Link>
        )}
      </form>

      {recherche ? (
        <>
          <section aria-labelledby="titre-res-activites" className="flex flex-col gap-4">
            <h2 id="titre-res-activites" className="titre-2 m-0">
              Activités ({activites.length})
            </h2>
            {activites.length ? (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
                {activites.map((a) => (
                  <li key={a.id} className="flex">
                    <CarteActivite a={a} passee={a.date < aujourdhui} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-encre-douce">Aucune activité trouvée.</p>
            )}
          </section>
          <section aria-labelledby="titre-res-documents" className="flex flex-col gap-4">
            <h2 id="titre-res-documents" className="titre-2 m-0">
              Documents ({documents.length === LIMITE ? `${LIMITE} premiers` : documents.length})
            </h2>
            {documents.length ? (
              <ul className="m-0 grid list-none grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-6 p-0">
                {documents.map((d) => (
                  <li key={d.id} className="flex">
                    <CarteDocument d={d} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-encre-douce">Aucun document trouvé.</p>
            )}
          </section>
        </>
      ) : (
        <section aria-labelledby="titre-mandats" className="flex flex-col gap-4">
          <h2 id="titre-mandats" className="titre-2 m-0">
            Mandats
          </h2>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {mandats.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <h3 className="titre-3 m-0">Mandat {m.libelle}</h3>
                  <span className={"rounded-s px-2 py-0.5 text-xs font-semibold " + (m.statut === "en_cours" ? "bg-vert-esatic text-sur-vert" : "bg-creme text-encre")}>
                    {m.statut === "en_cours" ? "En cours" : "Clos"}
                  </span>
                  <Link href={`/archives?mandat=${m.id}`} className="text-sm">
                    {m.documents} document{m.documents > 1 ? "s" : ""} · {m.activites} activité{m.activites > 1 ? "s" : ""}
                  </Link>
                </div>
                {(volets.get(m.id) ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <span className="text-encre-douce">Dossiers de passation :</span>
                    {volets.get(m.id)!.map((v) => (
                      <a key={v.cle} href={`/api/passation?mandat=${m.id}&cle=${v.cle}`} className="flex items-center gap-1">
                        <FileDown size={16} aria-hidden />
                        {v.nom}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
