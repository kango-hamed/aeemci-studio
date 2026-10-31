import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { mandatsDeLaSection } from "@/fonctionnalites/mandats/archives";
import { ImportArchives } from "@/fonctionnalites/mandats/ImportArchives";
import { estBureau } from "@/fonctionnalites/organisation/droits";
import { delegationsDe, mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Importer d'anciens dossiers" };

export default async function PageImporter() {
  const u = await exigerUtilisateur();
  const m = await mandatCourant();
  const bureau = u.estAdministrateur || estBureau(u);
  const [mandats, delegations] = m && bureau ? await Promise.all([mandatsDeLaSection(m.sectionId), delegationsDe(m.sectionId, m.id)]) : [[], []];

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/archives">Archives</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Importer</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Importer d&apos;anciens dossiers</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          PV, rapports, lettres et photos des mandats passés : choisis le mandat et la délégation, puis dépose les fichiers d&apos;un coup. Ils deviennent
          cherchables dans les archives.
        </p>
      </div>
      {bureau && m ? (
        <ImportArchives mandats={mandats.map((x) => ({ id: x.id, libelle: x.libelle }))} delegations={delegations.map((d) => ({ id: d.id, nom: d.nom }))} />
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">Réservé au bureau exécutif.</p>
      )}
    </>
  );
}
