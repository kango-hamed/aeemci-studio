import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteDocument } from "@/fonctionnalites/documents/CarteDocument";
import { documentsDe } from "@/fonctionnalites/documents/requetes";
import { CarteGabarit } from "@/fonctionnalites/gabarits/CarteGabarit";
import { gabaritsDisponibles } from "@/fonctionnalites/gabarits/requetes";

export const metadata: Metadata = { title: "Accueil" };

function prenom(nom: string) {
  return nom.split(/\s+/)[0] ?? nom;
}

export default async function PageAccueil() {
  const u = await exigerUtilisateur();
  const [gabarits, documents] = await Promise.all([gabaritsDisponibles(), documentsDe(u, 4)]);
  const surtitre = u.affectation ? `${u.affectation.delegation ?? "Bureau exécutif"} · Mandat ${u.affectation.mandat}` : "Section ESATIC";

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="etiquette text-encre-douce">{surtitre}</span>
          <h1 className="titre-1 m-0">Bonjour {prenom(u.nom)}</h1>
          <p className="m-0 max-w-[680px] text-encre-douce">Choisis un gabarit, remplis le formulaire : ton affiche est prête à partager.</p>
        </div>
        <Link href="/gabarits" className="flex min-h-12 items-center gap-2 rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert no-underline">
          <Plus size={20} aria-hidden />
          Créer un document
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="titre-2 m-0">Gabarits</h2>
          {gabarits.length > 4 && <Link href="/gabarits">Tous les gabarits</Link>}
        </div>
        {gabarits.length ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6 p-0">
            {gabarits.slice(0, 4).map((g) => (
              <li key={g.id} className="flex">
                <CarteGabarit g={g} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 rounded-l bg-creme p-6 text-sm leading-5">
            Aucun gabarit publié pour l&apos;instant. Les gabarits préparés dans Photoshop par la cellule communication apparaîtront ici.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="titre-2 m-0">Mes documents récents</h2>
          {documents.length > 0 && <Link href="/documents">Tous mes documents</Link>}
        </div>
        {documents.length ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6 p-0">
            {documents.map((d) => (
              <li key={d.id} className="flex">
                <CarteDocument d={d} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 rounded-l bg-creme p-6 text-sm leading-5">Tu n&apos;as encore créé aucun document.</p>
        )}
      </section>
    </>
  );
}
