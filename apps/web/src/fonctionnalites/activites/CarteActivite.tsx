import Link from "next/link";
import { CalendarDays, FileText, MapPin } from "lucide-react";
import { dateSaisie, heureSaisie } from "@/fonctionnalites/administratif/mise-en-page";
import type { ResumeActivite } from "./requetes";

export function CarteActivite({ a, passee }: { a: ResumeActivite; passee: boolean }) {
  return (
    <Link
      href={`/activites/${a.id}`}
      className="group flex w-full flex-col gap-2 rounded-l border border-trait bg-surface-relevee p-4 text-encre no-underline shadow-carte hover:border-vert-esatic"
    >
      <span className="etiquette text-orange-texte">{a.delegation ?? "Bureau exécutif"}</span>
      <span className="titre-3 group-hover:text-vert-esatic">{a.titre}</span>
      <span className="flex flex-col gap-1 text-sm text-encre-douce">
        <span className="flex items-center gap-1.5">
          <CalendarDays size={16} aria-hidden />
          {dateSaisie(a.date)}
          {a.heure ? ` · ${heureSaisie(a.heure)}` : ""}
        </span>
        {a.lieu && (
          <span className="flex items-center gap-1.5">
            <MapPin size={16} aria-hidden />
            {a.lieu}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <FileText size={16} aria-hidden />
          {a.documents ? `${a.documents} document${a.documents > 1 ? "s" : ""}` : "Aucun document"}
          {passee && !a.aUnBilan && <span className="ml-auto rounded-s bg-creme px-2 py-0.5 text-xs font-semibold text-orange-texte">Bilan à faire</span>}
        </span>
      </span>
    </Link>
  );
}
