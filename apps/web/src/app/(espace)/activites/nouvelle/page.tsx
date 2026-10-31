import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { FormulaireActivite } from "@/fonctionnalites/activites/FormulaireActivite";
import { estBureau, peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { delegationsDe, mandatCourant } from "@/fonctionnalites/organisation/requetes";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";

export const metadata: Metadata = { title: "Nouvelle activité" };

export default async function PageNouvelleActivite() {
  const u = await exigerUtilisateur();
  const m = await mandatCourant();
  const bureau = u.estAdministrateur || estBureau(u);
  const delegations = bureau && m ? (await delegationsDe(m.sectionId, m.id)).filter((d) => !d.archivee) : undefined;
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/activites">Activités</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Nouvelle</span>
      </nav>
      <h1 className="titre-1 m-0">Nouvelle activité</h1>
      {peutCreerDocuments(u) ? (
        <div className="max-w-[720px]">
          <FormulaireActivite delegations={delegations} aUneDelegation={Boolean(u.affectation?.delegationId)} />
        </div>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>
      )}
    </>
  );
}
