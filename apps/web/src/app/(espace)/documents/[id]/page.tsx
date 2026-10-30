import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { dateFr } from "@/fonctionnalites/documents/CarteDocument";
import { ActionsDocument } from "@/fonctionnalites/documents/ActionsDocument";
import { documentLisible } from "@/fonctionnalites/documents/requetes";
import { LARGEUR_HD } from "@/fonctionnalites/generation/rendu";

export const metadata: Metadata = { title: "Document" };

export default async function PageDocument({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerUtilisateur();
  const l = await documentLisible((await params).id, u);
  if (!l) notFound();
  const plan = l.revision.contenu.plans.find((p) => p.plan === l.d.plan);
  const largeurHd = Math.min(LARGEUR_HD, plan?.largeur_px ?? l.d.largeur);
  const hauteurHd = plan ? Math.round((largeurHd * plan.hauteur_px) / plan.largeur_px) : l.d.hauteur;
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/documents">Mes documents</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">{l.d.titre}</span>
      </nav>
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par l'API après contrôle de session */}
        <img
          src={`/api/documents/${l.d.id}/fichier`}
          alt={`Document « ${l.d.titre} »`}
          width={l.d.largeur}
          height={l.d.hauteur}
          className="block h-auto w-full max-w-[640px] rounded-l border border-trait bg-surface-relevee shadow-carte"
        />
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="etiquette text-encre-douce">{l.gabarit}</span>
            <h1 className="titre-2 m-0">{l.d.titre}</h1>
            <p className="m-0 text-sm leading-5 text-encre-douce">
              Créé le {dateFr(l.d.createdAt)} · gabarit révision {l.numero}
            </p>
          </div>
          <ActionsDocument
            id={l.d.id}
            titre={l.d.titre}
            largeur={l.d.largeur}
            hauteur={l.d.hauteur}
            largeurHd={largeurHd}
            hauteurHd={hauteurHd}
          />
          <Link href={`/creer/${l.gabaritId}`} className="font-semibold">
            Créer un autre document avec ce gabarit
          </Link>
        </div>
      </div>
    </>
  );
}
