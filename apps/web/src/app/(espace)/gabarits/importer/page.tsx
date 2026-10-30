import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ImportGabarit } from "@/fonctionnalites/gabarits/ImportGabarit";

export const metadata: Metadata = { title: "Importer un gabarit" };

export default async function PageImporter() {
  const u = await exigerUtilisateur();
  if (!u.estAdministrateur) notFound();
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/gabarits">Gabarits</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Importer</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Importer un gabarit</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          Un gabarit déjà importé sous le même nom reçoit une nouvelle révision : les documents créés avant gardent l&apos;ancienne.
        </p>
      </div>
      <ImportGabarit />
    </>
  );
}
