import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { FormulaireDepot } from "@/fonctionnalites/documents/FormulaireDepot";
import { peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";

export const metadata: Metadata = { title: "Déposer un fichier" };

export default async function PageDeposer() {
  const u = await exigerUtilisateur();
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/documents">Documents</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Déposer</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Déposer un fichier</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          Un PV, une lettre scannée, une affiche faite ailleurs : déposé ici, il est rangé avec les documents de ta délégation au lieu de se perdre dans un
          téléphone.
        </p>
      </div>
      {peutCreerDocuments(u) ? <FormulaireDepot aUneDelegation={Boolean(u.affectation?.delegationId)} /> : <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>}
    </>
  );
}
