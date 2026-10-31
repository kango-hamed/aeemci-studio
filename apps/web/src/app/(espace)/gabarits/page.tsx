import type { Metadata } from "next";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteGabarit } from "@/fonctionnalites/gabarits/CarteGabarit";
import { gabaritsDisponibles } from "@/fonctionnalites/gabarits/requetes";
import { peutGererGabarits } from "@/fonctionnalites/organisation/droits";

export const metadata: Metadata = { title: "Choisir un gabarit" };

export default async function PageGabarits() {
  const u = await exigerUtilisateur();
  const gabarits = await gabaritsDisponibles(u);
  const gestion = peutGererGabarits(u);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="etiquette text-encre-douce">Étape 1 sur 2</span>
          <h1 className="titre-1 m-0">Choisir un gabarit</h1>
          <p className="m-0 max-w-[680px] text-encre-douce">Chaque gabarit est une affiche préparée par la cellule communication : tu n&apos;as plus qu&apos;à remplir le formulaire.</p>
        </div>
        {gestion && (
          <Link href="/gabarits/gerer" className="flex min-h-11 items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold no-underline">
            <Settings2 size={18} aria-hidden />
            Gérer les gabarits
          </Link>
        )}
      </div>
      {gabarits.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6 p-0">
          {gabarits.map((g) => (
            <li key={g.id} className="flex">
              <CarteGabarit g={g} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">
          Aucun gabarit n&apos;est encore publié.{" "}
          {gestion ? <Link href="/gabarits/importer">Importe le premier dossier du plugin Photoshop.</Link> : "La cellule communication les publie depuis Photoshop."}
        </p>
      )}
    </>
  );
}
