import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { seDeconnecter } from "@/fonctionnalites/authentification/actions";
import type { Utilisateur } from "@/fonctionnalites/authentification/session";
import { peutGererOrganisation } from "@/fonctionnalites/organisation/droits";
import { LIBELLES_ROLES } from "@/fonctionnalites/organisation/roles";
import { NAVIGATION } from "@/fonctionnalites/navigation";
import { BarreOnglets } from "./BarreOnglets";
import { LienNavigation } from "./LienNavigation";

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join("");
}

export function descriptionRole(u: Utilisateur): string {
  if (u.affectation) {
    const lieu = u.affectation.delegation ?? "Bureau exécutif";
    return `${LIBELLES_ROLES[u.affectation.role]} · ${lieu} · ${u.affectation.mandat}`;
  }
  return u.estAdministrateur ? "Administrateur de la plateforme" : "Sans rôle dans le mandat en cours";
}

/**
 * `aValider` : nombre de documents officiels qui attendent la validation, pour le président (ou le vice-président en intérim).
 * À partir de 1024 px, menu et profil dans l'en-tête ; en dessous, en-tête réduit et barre d'onglets en bas (`BarreOnglets`).
 */
export function EnTete({ utilisateur, aValider }: { utilisateur: Utilisateur; aValider: number | null }) {
  const entrees = NAVIGATION.filter(
    (e) => !e.reserve || (e.reserve === "administrateur" ? utilisateur.estAdministrateur : peutGererOrganisation(utilisateur)),
  );
  return (
    <header className="bg-vert-profond pt-[env(safe-area-inset-top)] text-sur-vert-profond">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5 sm:px-6 lg:py-3">
        <Link href="/" className="flex items-center gap-3 text-sur-vert-profond no-underline">
          <span className="flex rounded-m bg-[#fcfaf2] px-2 py-1 lg:px-2.5 lg:py-1.5">
            <Image src="/logo-aeemci-esatic.png" alt="Logo AEEMCI ESATIC" width={54} height={32} priority className="h-7 w-auto lg:h-8" />
          </span>
          <span className="font-titre text-lg font-bold">AEEMCI Studio</span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden flex-auto flex-wrap gap-1 lg:flex">
          {entrees.map((e) => (
            <LienNavigation key={e.href} href={e.href} aussi={e.aussi}>
              {aValider !== null && e.libelleValideur ? e.libelleValideur : e.libelle}
              {aValider !== null && e.libelleValideur && aValider > 0 && (
                <span className="ml-1.5 rounded-full bg-orange-croissant px-2 text-sm font-bold text-sur-orange">
                  {aValider}
                  <span className="sr-only"> en attente</span>
                </span>
              )}
            </LienNavigation>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-or font-titre font-bold text-sur-orange"
          >
            {initiales(utilisateur.nom)}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-semibold">{utilisateur.nom}</span>
            <span className="text-[13px] opacity-80">{descriptionRole(utilisateur)}</span>
          </span>
          <Link href="/notifications" aria-label="Notifications" title="Notifications" className="ml-1 flex size-11 items-center justify-center rounded-m text-sur-vert-profond hover:bg-white/10">
            <Bell size={20} aria-hidden />
          </Link>
          <form action={seDeconnecter}>
            <button
              type="submit"
              className="ml-1 flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-m px-3 text-sm text-sur-vert-profond hover:bg-white/10"
            >
              <LogOut size={18} aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
      <BarreOnglets entrees={entrees} aValider={aValider} nom={utilisateur.nom} initiales={initiales(utilisateur.nom)} role={descriptionRole(utilisateur)} />
    </header>
  );
}
