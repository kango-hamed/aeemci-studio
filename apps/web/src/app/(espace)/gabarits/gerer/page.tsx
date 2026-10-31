import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderUp } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { gabaritsAGerer } from "@/fonctionnalites/gabarits/requetes";
import { peutGererGabarits } from "@/fonctionnalites/organisation/droits";

export const metadata: Metadata = { title: "Gérer les gabarits" };

/** Tous les gabarits (brouillons et désactivés compris), pour les administrateurs et les designers. */
export default async function PageGererGabarits() {
  const u = await exigerUtilisateur();
  if (!peutGererGabarits(u)) notFound();
  const gabarits = await gabaritsAGerer();
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/gabarits">Créer</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Gérer les gabarits</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="titre-1 m-0">Gérer les gabarits</h1>
          <p className="m-0 max-w-[680px] text-encre-douce">
            Importe le dossier produit par le plugin Photoshop, règle le formulaire avec l&apos;aperçu, puis publie : les membres utilisent la nouvelle
            version aussitôt.
          </p>
        </div>
        <Link href="/gabarits/importer" className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert no-underline">
          <FolderUp size={18} aria-hidden />
          Importer un dossier
        </Link>
      </div>
      {gabarits.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6 p-0">
          {gabarits.map((g) => (
            <li key={g.id} className="flex">
              <Link
                href={`/gabarits/${g.id}/reglages`}
                className="flex w-full flex-col overflow-hidden rounded-l border border-trait bg-surface-relevee text-encre no-underline shadow-carte hover:border-vert-esatic"
              >
                <div className="flex aspect-square items-center justify-center bg-creme">
                  {g.aVignette ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette servie par l'application, derrière la connexion
                    <img src={`/api/gabarits/${g.id}/vignette?r=${g.numero}`} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-sm text-encre-douce">Pas encore publié</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 p-4">
                  <span className="font-semibold">{g.nom}</span>
                  <span className="text-sm text-encre-douce">
                    {g.numero ? `Révision ${g.numero}` : "Jamais publié"} · {g.documents} document{g.documents > 1 ? "s" : ""}
                  </span>
                  <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
                    {g.brouillon && <span className="rounded-s bg-fond-attention px-2 py-0.5 text-attention">Brouillon en cours</span>}
                    {!g.actif && <span className="rounded-s bg-creme px-2 py-0.5">Non proposé</span>}
                    {g.reserve > 0 && (
                      <span className="rounded-s bg-creme px-2 py-0.5">
                        Réservé à {g.reserve} délégation{g.reserve > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">Aucun gabarit pour l&apos;instant : importe le premier dossier produit par le plugin.</p>
      )}
    </>
  );
}
