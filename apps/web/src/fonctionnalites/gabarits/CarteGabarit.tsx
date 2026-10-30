import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import type { GabaritDisponible } from "./requetes";

export function CarteGabarit({ g }: { g: GabaritDisponible }) {
  return (
    <Link
      href={`/creer/${g.id}`}
      className="group flex flex-col overflow-hidden rounded-l border border-trait bg-surface-relevee text-encre no-underline shadow-carte hover:border-vert-esatic"
    >
      <span className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-creme">
        {g.aVignette ? (
          // eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par l'API après contrôle de session
          <img src={`/api/gabarits/${g.id}/vignette?r=${g.revisionId}`} alt="" loading="lazy" className="size-full object-cover object-top" />
        ) : (
          <LayoutTemplate size={40} aria-hidden className="text-orange-texte" />
        )}
      </span>
      <span className="flex flex-col gap-0.5 p-4">
        <span className="titre-3 group-hover:text-vert-esatic">{g.nom}</span>
        <span className="text-sm leading-5 text-encre-douce">
          {g.largeur} × {g.hauteur} px{g.nbPlans > 1 ? ` · ${g.nbPlans} déclinaisons` : ""}
        </span>
      </span>
    </Link>
  );
}
