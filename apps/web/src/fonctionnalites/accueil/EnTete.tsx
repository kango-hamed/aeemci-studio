import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { seDeconnecter } from "@/fonctionnalites/authentification/actions";
import type { Utilisateur } from "@/fonctionnalites/authentification/session";
import { peutGererOrganisation } from "@/fonctionnalites/organisation/droits";
import { LIBELLES_ROLES } from "@/fonctionnalites/organisation/roles";
import { NAVIGATION } from "@/fonctionnalites/navigation";
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

/** `aValider` : nombre de documents officiels qui attendent la validation, pour le président (ou le vice-président en intérim). */
export function EnTete({ utilisateur, aValider }: { utilisateur: Utilisateur; aValider: number | null }) {
  const entrees = NAVIGATION.filter(
    (e) => !e.reserve || (e.reserve === "administrateur" ? utilisateur.estAdministrateur : peutGererOrganisation(utilisateur)),
  );
  return (
    <header className="bg-vert-profond text-sur-vert-profond">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-sur-vert-profond no-underline">
          <span className="flex rounded-m bg-surface-relevee px-2.5 py-1.5">
            <Image src="/logo-aeemci-esatic.png" alt="Logo AEEMCI ESATIC" width={54} height={32} priority />
          </span>
          <span className="font-titre text-lg font-bold">AEEMCI Studio</span>
        </Link>

        <nav aria-label="Navigation principale" className="flex flex-auto flex-wrap gap-1">
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

        <div className="flex items-center gap-2.5">
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
    </header>
  );
}
