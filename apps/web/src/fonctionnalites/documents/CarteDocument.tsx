import Link from "next/link";
import type { ResumeDocument } from "./requetes";

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

export function dateFr(d: Date) {
  return date.format(d).replace(":", " h ");
}

export function CarteDocument({ d }: { d: ResumeDocument }) {
  return (
    <Link href={`/documents/${d.id}`} className="group flex flex-col overflow-hidden rounded-l border border-trait bg-surface-relevee text-encre no-underline shadow-carte hover:border-vert-esatic">
      {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé servi par l'API après contrôle de session */}
      <img src={`/api/documents/${d.id}/miniature`} alt="" loading="lazy" width={360} height={Math.round((360 * d.hauteur) / d.largeur)} className="block aspect-[4/5] h-auto w-full bg-creme object-cover object-top" />
      <span className="flex flex-col gap-0.5 p-4">
        <span className="font-semibold group-hover:text-vert-esatic">{d.titre}</span>
        <span className="text-sm leading-5 text-encre-douce">{dateFr(d.createdAt)}</span>
      </span>
    </Link>
  );
}
