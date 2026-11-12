import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { EquipesDuMandat } from "@/fonctionnalites/activites/EquipesDuMandat";
import { equipesDuMandat, estPcoDuMandat } from "@/fonctionnalites/activites/organigramme";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Équipes du mandat" };

/** Équipes réutilisables d'une activité à l'autre : réservées aux PCO (et adjoints) du mandat en cours. */
export default async function PageEquipes() {
  const u = await exigerUtilisateur();
  const m = await mandatCourant();
  const pco = m ? await estPcoDuMandat(u, m.id) : false;
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/activites">Activités</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Équipes du mandat</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Équipes du mandat</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          Une équipe (Communication, Sécurité…) sert dans plusieurs activités : chaque PCO la reprend dans l&apos;organigramme de la sienne. Une modification se voit partout où elle est reprise.
        </p>
      </div>
      {pco && m ? (
        <EquipesDuMandat equipes={await equipesDuMandat(u, m.id)} />
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">Les équipes du mandat sont gérées par les PCO et leurs adjoints. Tu n&apos;es PCO d&apos;aucune activité du mandat en cours.</p>
      )}
    </>
  );
}
