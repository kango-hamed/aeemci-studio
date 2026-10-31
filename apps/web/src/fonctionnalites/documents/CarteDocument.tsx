import Link from "next/link";
import { FileText } from "lucide-react";
import type { ResumeDocument } from "./requetes";

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

export function dateFr(d: Date) {
  return date.format(d).replace(":", " h ");
}

export function CarteDocument({ d }: { d: ResumeDocument }) {
  return (
    <Link href={`/documents/${d.id}`} className="group flex w-full flex-col overflow-hidden rounded-l border border-trait bg-surface-relevee text-encre no-underline shadow-carte hover:border-vert-esatic">
      <span className="relative block">
        {d.aMiniature ? (
          // eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par l'API après contrôle de session
          <img
            src={`/api/documents/${d.id}/miniature`}
            alt=""
            loading="lazy"
            width={360}
            height={d.largeur && d.hauteur ? Math.round((360 * d.hauteur) / d.largeur) : 450}
            className="block aspect-[4/5] h-auto w-full bg-creme object-cover object-top"
          />
        ) : (
          <span className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-creme text-orange-texte">
            <FileText size={40} aria-hidden />
            <span className="etiquette">{d.type === "application/pdf" ? "PDF" : "Fichier"}</span>
          </span>
        )}
        {d.statut === "brouillon" && <span className="absolute top-2 left-2 rounded-s bg-encre px-2 py-1 text-xs font-semibold text-surface">Brouillon</span>}
      </span>
      <span className="flex flex-col gap-0.5 p-4">
        <span className="font-semibold group-hover:text-vert-esatic">{d.titre}</span>
        <span className="text-sm leading-5 text-encre-douce">
          {d.estAMoi ? "" : `${d.auteur} · `}
          {dateFr(d.createdAt)}
        </span>
      </span>
    </Link>
  );
}
