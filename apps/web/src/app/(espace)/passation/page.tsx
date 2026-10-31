import type { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ClotureMandat } from "@/fonctionnalites/mandats/ClotureMandat";
import { NotePassation } from "@/fonctionnalites/mandats/NotePassation";
import { CLE_BUREAU, voletsDuMandat } from "@/fonctionnalites/mandats/passation";
import { peutCloreMandat, peutEcrirePassation } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Passation" };

/** Préparer la passation du mandat en cours : dossiers par délégation, points en suspens, clôture. */
export default async function PagePassation() {
  const u = await exigerUtilisateur();
  const m = await mandatCourant();
  const volets = m ? await voletsDuMandat(u, m.id) : [];

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/archives">Archives</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Passation</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Passation{m ? ` du mandat ${m.libelle}` : ""}</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          Le dossier de passation de chaque délégation rassemble ses membres, ses activités et leurs bilans, ses documents et les points en suspens. Note ici ce que
          l&apos;équipe suivante doit savoir, avant la clôture du mandat.
        </p>
      </div>
      {volets.length ? (
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
          {volets.map((v) => (
            <li key={v.cle} className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="titre-3 m-0">{v.nom}</h2>
                <a href={`/api/passation?mandat=${m!.id}&cle=${v.cle}`} className="flex min-h-11 items-center gap-2 font-semibold">
                  <FileDown size={18} aria-hidden />
                  Dossier PDF
                </a>
              </div>
              {peutEcrirePassation(u, v.cle === CLE_BUREAU ? null : v.cle) ? (
                <NotePassation cle={v.cle} nom={v.nom} texte={v.note ?? ""} />
              ) : (
                <p className="m-0 whitespace-pre-line text-sm text-encre-douce">{v.note ?? "Aucun point en suspens noté."}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">Aucun dossier de passation à consulter pour ton rôle.</p>
      )}
      {m && peutCloreMandat(u) && (
        <section aria-labelledby="titre-cloture" className="flex flex-col gap-4 rounded-l border border-danger p-5">
          <h2 id="titre-cloture" className="titre-2 m-0">
            Clore le mandat {m.libelle}
          </h2>
          <ClotureMandat mandat={m.libelle} />
        </section>
      )}
    </>
  );
}
