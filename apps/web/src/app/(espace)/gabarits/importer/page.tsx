import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ImportGabarit } from "@/fonctionnalites/gabarits/ImportGabarit";
import { gabaritsAGerer } from "@/fonctionnalites/gabarits/requetes";
import { peutGererGabarits } from "@/fonctionnalites/organisation/droits";

export const metadata: Metadata = { title: "Importer un gabarit" };

export default async function PageImporter({ searchParams }: { searchParams: Promise<{ gabarit?: string }> }) {
  const u = await exigerUtilisateur();
  if (!peutGererGabarits(u)) notFound();
  const [gabarits, { gabarit }] = await Promise.all([gabaritsAGerer(), searchParams]);
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/gabarits/gerer">Gabarits</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Importer</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Importer un gabarit</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          Le dossier devient un brouillon à régler puis publier. Pour un gabarit existant, ses réglages (libellés, aides, textes trop longs) sont repris,
          et les documents déjà créés gardent leur révision.
        </p>
      </div>
      <ImportGabarit gabarits={gabarits.map((g) => ({ id: g.id, nom: g.nom }))} cible={gabarits.some((g) => g.id === gabarit) ? gabarit : undefined} />
    </>
  );
}
