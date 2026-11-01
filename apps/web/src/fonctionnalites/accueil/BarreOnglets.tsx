"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Archive, BadgeCheck, Bell, CalendarDays, FileText, House, LogOut, Menu, Palette, PenLine, Users, X, type LucideIcon } from "lucide-react";
import { seDeconnecter } from "@/fonctionnalites/authentification/actions";
import type { EntreeNavigation } from "@/fonctionnalites/navigation";

/** Entrées toujours visibles dans la barre ; les autres passent dans « Plus ». */
const ONGLETS = ["/", "/gabarits", "/documents", "/a-valider"];

const ICONES: Record<string, LucideIcon> = {
  "/": House,
  "/gabarits": Palette,
  "/documents": FileText,
  "/a-valider": BadgeCheck,
  "/activites": CalendarDays,
  "/archives": Archive,
  "/organisation": Users,
  "/signature": PenLine,
  "/notifications": Bell,
};

function estActif(chemin: string, e: Pick<EntreeNavigation, "href" | "aussi">) {
  return e.href === "/" ? chemin === "/" : [e.href, ...(e.aussi ?? [])].some((h) => chemin === h || chemin.startsWith(h + "/"));
}

/**
 * Navigation du téléphone (sous 1024 px) : barre d'onglets fixée en bas, à portée du pouce, et un
 * panneau « Plus » pour le reste du menu, le profil et la déconnexion.
 */
export function BarreOnglets(p: { entrees: EntreeNavigation[]; aValider: number | null; nom: string; initiales: string; role: string }) {
  const chemin = usePathname();
  const panneau = useRef<HTMLDialogElement>(null);
  const onglets = p.entrees.filter((e) => ONGLETS.includes(e.href));
  // La signature et les notifications ne sont pas au menu du bureau : sur téléphone, on les met à portée dans « Plus ».
  const autres = [
    ...p.entrees.filter((e) => !ONGLETS.includes(e.href)),
    { href: "/signature", libelle: "Ma signature" },
    { href: "/notifications", libelle: "Notifications" },
  ];
  const plusActif = autres.some((e) => estActif(chemin, e)) && !onglets.some((e) => estActif(chemin, e));

  // Une navigation depuis le panneau le referme.
  useEffect(() => panneau.current?.close(), [chemin]);

  const libelle = (e: EntreeNavigation) => (p.aValider !== null && e.libelleValideur ? e.libelleValideur : e.libelle);
  const onglet = "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] leading-tight no-underline";

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-white/10 bg-vert-profond pb-[env(safe-area-inset-bottom)] text-sur-vert-profond lg:hidden"
      >
        {onglets.map((e) => {
          const Icone = ICONES[e.href] ?? FileText;
          const actif = estActif(chemin, e);
          const badge = p.aValider !== null && e.libelleValideur && p.aValider > 0 ? p.aValider : 0;
          return (
            <Link key={e.href} href={e.href} aria-current={actif ? "page" : undefined} className={`${onglet} text-sur-vert-profond ${actif ? "font-semibold" : "opacity-80"}`}>
              <span className={`flex h-8 w-14 items-center justify-center rounded-full ${actif ? "bg-white/15" : ""}`}>
                <Icone size={22} aria-hidden />
              </span>
              {libelle(e)}
              {badge > 0 && (
                <span className="absolute top-1 left-1/2 ml-2 min-w-5 rounded-full bg-orange-croissant px-1.5 text-center text-[11px] font-bold text-sur-orange">
                  {badge}
                  <span className="sr-only"> en attente</span>
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => panneau.current?.showModal()}
          aria-haspopup="dialog"
          className={`${onglet} text-sur-vert-profond ${plusActif ? "font-semibold" : "opacity-80"}`}
        >
          <span className={`flex h-8 w-14 items-center justify-center rounded-full ${plusActif ? "bg-white/15" : ""}`}>
            <Menu size={22} aria-hidden />
          </span>
          Plus
        </button>
      </nav>

      <dialog
        ref={panneau}
        aria-label="Plus"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-[20px] bg-surface p-0 text-encre shadow-flottante backdrop:bg-black/40 lg:hidden"
      >
        <div className="flex flex-col gap-2 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 border-b border-trait pb-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-or font-titre font-bold text-sur-orange">
              {p.initiales}
            </span>
            <span className="flex min-w-0 flex-auto flex-col leading-tight">
              <span className="font-semibold">{p.nom}</span>
              <span className="text-sm text-encre-douce">{p.role}</span>
            </span>
            <button type="button" onClick={() => panneau.current?.close()} className="flex size-11 shrink-0 items-center justify-center rounded-full text-encre-douce">
              <X size={22} aria-hidden />
              <span className="sr-only">Fermer</span>
            </button>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {autres.map((e) => {
              const Icone = ICONES[e.href] ?? FileText;
              const actif = estActif(chemin, e);
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    aria-current={actif ? "page" : undefined}
                    className={`flex min-h-13 items-center gap-4 rounded-m px-3 text-encre no-underline ${actif ? "bg-creme font-semibold" : ""}`}
                  >
                    <Icone size={22} aria-hidden className="text-vert-esatic" />
                    {e.libelle}
                  </Link>
                </li>
              );
            })}
          </ul>
          <form action={seDeconnecter} className="border-t border-trait pt-2">
            <button type="submit" className="flex min-h-13 w-full items-center gap-4 rounded-m px-3 text-danger">
              <LogOut size={22} aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
